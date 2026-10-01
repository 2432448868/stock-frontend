#!/usr/bin/env node
const fs = require('node:fs');
const path = require('node:path');
const { beijingNow, isTradingDay, previousTradingDay } = require('./scripts/data/calendar.cjs');
const { FILTERS, INDICES, fetchBoards, fetchIndex } = require('./scripts/data/sources.cjs');
const { readJson, publishGroup, pruneHistory } = require('./scripts/data/storage.cjs');
const DATA_DIR = path.join(__dirname, 'public', 'data');
const SCHEMA_VERSION = 2;
const GROUPS = {
  industry: ['industry.json', 'capital-industry.json'],
  concept: ['concept.json', 'capital-concept.json'],
  region: ['region.json'],
  ...Object.fromEntries(INDICES.map(index => [index.code,
    ['kline-' + index.code + '-daily.json', 'kline-' + index.code + '-weekly.json']])),
};
function metadata(files) {
  const items = files.map(file => readJson(path.join(DATA_DIR, file)));
  const dates = items.map(item => item?.dataDate).filter(Boolean);
  return {
    dataDate: dates.length === items.length && new Set(dates).size === 1 ? dates[0] : null,
    updatedAt: items[0]?.updatedAt || null,
    freshness: items.every(item => item?.freshness === 'verified') ? 'verified' : 'provisional',
    source: items[0]?.source || null,
  };
}
function isComplete(files, targetDate) {
  const items = files.map(file => readJson(path.join(DATA_DIR, file)));
  return items.every(item => item?.schemaVersion === SCHEMA_VERSION && item.dataDate === targetDate &&
    item.freshness === 'verified' && item.batchId &&
    Array.isArray(item.data || item.klines) && (item.data || item.klines).length > 0) &&
    new Set(items.map(item => item.batchId)).size === 1;
}
async function main() {
  const now = beijingNow();
  const requestedSlot = process.env.FETCH_SLOT || 'auto';
  if (!['auto', 'morning', 'afternoon'].includes(requestedSlot)) throw new Error('FETCH_SLOT 必须为 auto/morning/afternoon');
  const slot = requestedSlot === 'auto' ? (now.time < '12:00:00' ? 'morning' : 'afternoon') : requestedSlot;
  if (!isTradingDay(now.date)) { console.log('休市日，跳过采集'); return; }
  if ((slot === 'afternoon' && now.time < '15:00:00') || (slot === 'morning' && now.time < '09:00:00')) {
    throw new Error('尚未到本轮采集时间，不发布非预期时段数据');
  }
  const targetDate = slot === 'morning' ? previousTradingDay(now.date) : now.date;
  const status = { schemaVersion: SCHEMA_VERSION, attemptedAt: new Date().toISOString(), slot, targetDate, groups: {} };
  const base = { schemaVersion: SCHEMA_VERSION, dataDate: targetDate,
    updatedAt: now.date + ' ' + now.time, freshness: slot === 'morning' ? 'verified' : 'provisional' };
  let failed = 0;
  publishGroup(DATA_DIR, { 'status.json': { ...status, state: 'running' } });
  for (const group of [...Object.keys(FILTERS), ...INDICES.map(index => index.code)]) {
    const names = GROUPS[group];
    try {
      if (isComplete(names, targetDate)) {
        status.groups[group] = { state: 'cached', ...metadata(names) };
        console.log(group + ' 目标交易日已有完整补采数据，跳过');
        continue;
      }
      const meta = { ...base, batchId: status.attemptedAt + '-' + group };
      const output = {};
      if (Object.hasOwn(FILTERS, group)) {
        // clist是当前快照，不能在竞价/盘中用它伪造前一天的数据。
        const time = beijingNow();
        if (time.date !== now.date || (slot === 'morning' && time.time >= '09:15:00')) {
          throw new Error('上午补采窗口已结束，保留旧快照；不把当日数据冒充前一交易日');
        }
        const result = await fetchBoards(group, targetDate);
        const finished = beijingNow();
        if (finished.date !== now.date || (slot === 'morning' && finished.time >= '09:15:00')) throw new Error('分页采集跨过补采窗口，丢弃本组');
        const common = { ...meta, source: result.source, sourceUpdatedAt: result.sourceUpdatedAt };
        output[names[0]] = { ...common, data: result.sectors };
        if (result.capital) output[names[1]] = { ...common, data: result.capital };
        for (const name of names) output['history/' + name.replace('.json', '-' + targetDate + '.json')] = output[name];
      } else {
        const index = INDICES.find(item => item.code === group);
        const result = await fetchIndex(index, targetDate);
        const common = { ...meta, source: result.source, name: index.name, volumeUnit: result.volumeUnit };
        output[names[0]] = { ...common, klines: result.daily };
        output[names[1]] = { ...common, derivedFrom: 'daily', klines: result.weekly };
      }
      publishGroup(DATA_DIR, output);
      status.groups[group] = { state: 'updated', ...metadata(names) };
      console.log(group + ' 更新完成：' + targetDate + ' / ' + base.freshness);
    } catch (error) {
      failed++;
      status.groups[group] = { state: 'failed', ...metadata(names), error: error.message };
      console.error(group + ' 失败，保留旧数据：' + error.message);
    }
  }
  status.state = failed === 0 ? 'ok' : failed === Object.keys(GROUPS).length ? 'failed' : 'partial';
  status.completedAt = new Date().toISOString();
  publishGroup(DATA_DIR, { 'status.json': status });
  try { pruneHistory(DATA_DIR, now.date); } catch (error) { console.warn('历史清理失败：' + error.message); }
  if (process.env.GITHUB_STEP_SUMMARY) {
    const lines = ['## 数据采集 ' + slot + ' / ' + targetDate, '',
      ...Object.entries(status.groups).map(([group, item]) => '- ' + group + ': ' + item.state +
        '；数据日 ' + (item.dataDate || '旧版未知') + (item.error ? '；' + item.error : '')), ''];
    fs.appendFileSync(process.env.GITHUB_STEP_SUMMARY, lines.join(String.fromCharCode(10)));
  }
  if (failed) process.exitCode = 1;
}
if (require.main === module) main().catch(error => { console.error(error); process.exitCode = 1; });
module.exports = { main };

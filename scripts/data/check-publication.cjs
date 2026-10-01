// 只读发布门禁：任何未结束批次或关联组不一致都不能部署。
const fs = require('node:fs');
const path = require('node:path');
const directory = path.resolve(__dirname, '../../public/data');
const files = new Map();
for (const name of fs.readdirSync(directory)) {
  if (name.endsWith('.tmp')) throw new Error('存在采集临时文件，拒绝发布');
  if (name.endsWith('.json')) files.set(name, JSON.parse(fs.readFileSync(path.join(directory, name), 'utf8')));
}
const status = files.get('status.json');
if (status && !['ok', 'partial', 'failed'].includes(status.state)) throw new Error('采集未正常结束，拒绝发布');
const groups = [
  ['industry.json', 'capital-industry.json'], ['concept.json', 'capital-concept.json'], ['region.json'],
  ...['000001', '399001', '399006'].map(code => ['kline-' + code + '-daily.json', 'kline-' + code + '-weekly.json']),
];
for (const names of groups) {
  const items = names.map(name => files.get(name));
  if (items.some(item => !item)) throw new Error('数据文件缺失：' + names.join(','));
  // 兼容迁移前整组旧数据；新旧混合不能发布。
  if (items.some(item => item.schemaVersion === 2)) {
    if (items.some(item => item.schemaVersion !== 2 || !item.batchId || !item.dataDate ||
        !['verified', 'provisional'].includes(item.freshness))) throw new Error('数据元信息不完整');
    if (new Set(items.map(item => item.batchId)).size !== 1 || new Set(items.map(item => item.dataDate)).size !== 1 ||
        new Set(items.map(item => item.freshness)).size !== 1) throw new Error('关联组批次不一致：' + names.join(','));
    for (const item of items) {
      const rows = item.data || item.klines;
      if (!Array.isArray(rows) || rows.length === 0) throw new Error('新数据为空');
    }
  }
}
console.log('发布数据结构检查通过（不代替上游行情真实性验证）');

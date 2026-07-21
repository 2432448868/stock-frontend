#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

const EASTMONEY_API = 'https://push2.eastmoney.com/api/qt/clist/get';
const KLINE_API = 'https://push2his.eastmoney.com/api/qt/stock/kline/get';

const SECTOR_TYPES = {
  industry: 'm:90 t:2',
  concept: 'm:90 t:3',
  region: 'm:90 t:1',
};

const CAPITAL_FLOW_TYPES = {
  'capital-industry': 'm:90 t:2',
  'capital-concept': 'm:90 t:3',
};

// 三大指数 K 线配置
const KLINE_INDICES = [
  { id: 'kline-000001', secid: '1.000001' },
  { id: 'kline-399001', secid: '0.399001' },
  { id: 'kline-399006', secid: '0.399006' },
];

// 2026 年 A 股休市日（法定节假日 + 周末已自动跳过）
const HOLIDAYS_2026 = new Set([
  // 元旦
  '2026-01-01', '2026-01-02',
  // 春节
  '2026-02-16', '2026-02-17', '2026-02-18', '2026-02-19', '2026-02-20',
  // 清明节
  '2026-04-06',
  // 劳动节
  '2026-05-01', '2026-05-04', '2026-05-05',
  // 端午节
  '2026-05-31', '2026-06-01',
  // 中秋节
  '2026-09-25',
  // 国庆节
  '2026-10-01', '2026-10-02', '2026-10-05', '2026-10-06', '2026-10-07', '2026-10-08',
]);

// 前端需要的字段（JSON 瘦身：只保留这些，其余丢弃）
const SECTOR_FIELDS = ['f12', 'f14', 'f2', 'f3', 'f4', 'f20', 'f104', 'f105', 'f128', 'f136'];
const CAPITAL_FIELDS = ['f12', 'f14', 'f3', 'f62', 'f184', 'f66', 'f72', 'f104', 'f105'];

// ========== API 请求 ==========

// 模拟真实浏览器的完整请求头，避免被反爬识别
const COMMON_HEADERS = {
  'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36',
  'Accept': '*/*',
  'Accept-Language': 'zh-CN,zh;q=0.9,en;q=0.8',
  'Referer': 'https://quote.eastmoney.com/',
};

// 请求间延迟，避免短时间大量请求触发反爬
function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

async function fetchPage(filterStr, fid, sort, fields, pageSize, page, retries = 4) {
  const params = new URLSearchParams({
    fs: filterStr, fid, po: sort,
    pz: String(pageSize), pn: String(page),
    np: '1', fltt: '2', invt: '2', ut: 'fa5fd1402c7fe063136ef88a0db19a9f',
    fields,
  });
  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      const res = await fetch(`${EASTMONEY_API}?${params}`, { headers: COMMON_HEADERS });
      const text = await res.text();

      // 502/503/429 → 服务端限流，等久一点再重试
      if (res.status === 502 || res.status === 503 || res.status === 429) {
        throw new Error(`HTTP ${res.status}（服务端限流）`);
      }
      if (!res.ok) {
        throw new Error(`HTTP ${res.status}，响应：${text.slice(0, 200)}`);
      }
      if (text.startsWith('<')) {
        throw new Error(`API 返回 HTML，前 200 字符：${text.slice(0, 200)}`);
      }

      const json = JSON.parse(text);
      if (!json.data?.diff) throw new Error(`第 ${page} 页 API 数据异常：${text.slice(0, 200)}`);
      return { items: json.data.diff, total: json.data.total };
    } catch (e) {
      if (attempt < retries) {
        // 指数退避 + 随机抖动：5s / 12s / 21s / 32s
        const wait = (4000 * attempt + Math.random() * 2000 * attempt);
        console.log(`  ⚠️ 第 ${page} 页请求失败（${e.message}），${attempt}/${retries} 重试，等待 ${Math.round(wait/1000)}s...`);
        await sleep(wait);
      } else {
        throw e;
      }
    }
  }
}

async function fetchAllPages(filterStr, fields) {
  const pageSize = 100;
  let all = [], page = 1, total = Infinity;
  while (all.length < total) {
    const { items, total: t } = await fetchPage(filterStr, 'f3', '1', fields, pageSize, page);
    total = t;
    all = all.concat(items);
    console.log(`  第 ${page} 页：${items.length} 条（总计 ${total}）`);
    if (items.length < pageSize) break;
    page++;
    await sleep(3000 + Math.random() * 2000); // 翻页间隔 3~5s
  }
  return all;
}

// ========== 数据转换（原始字段码 → 语义化命名） ==========

function transformSector(raw) {
  return {
    code: raw.f12,
    name: raw.f14,
    changePercent: raw.f3 != null ? +(raw.f3 / 100).toFixed(2) : 0,
    changeAmount: raw.f4 != null ? +(raw.f4 / 100).toFixed(2) : 0,
    marketCap: raw.f20 ?? 0,
    upCount: raw.f104 ?? 0,
    downCount: raw.f105 ?? 0,
    leadingStock: raw.f128 || '',
    leadingChange: raw.f136 != null ? +(raw.f136 / 100).toFixed(2) : 0,
  };
}

function transformCapital(raw) {
  return {
    code: raw.f12,
    name: raw.f14,
    changePercent: raw.f3 != null ? +(raw.f3 / 100).toFixed(2) : 0,
    mainNetFlow: raw.f62 ?? 0,
    mainPercent: raw.f184 ?? 0,
    superNetFlow: raw.f66 ?? 0,
    bigNetFlow: raw.f72 ?? 0,
    upCount: raw.f104 ?? 0,
    downCount: raw.f105 ?? 0,
  };
}

// ========== 数据校验（异常数据不入库） ==========

function validateSector(item) {
  if (!item.code || !item.name) return false;
  if (typeof item.changePercent !== 'number' || isNaN(item.changePercent)) return false;
  if (item.changePercent > 22 || item.changePercent < -22) return false; // 涨跌停 ±20% + 容差
  if (item.marketCap < 0) return false;
  if (item.upCount < 0 || item.downCount < 0) return false;
  return true;
}

function validateCapital(item) {
  if (!item.code || !item.name) return false;
  if (typeof item.mainNetFlow !== 'number' || isNaN(item.mainNetFlow)) return false;
  if (typeof item.changePercent !== 'number' || isNaN(item.changePercent)) return false;
  return true;
}

function validateKline(klines) {
  if (!Array.isArray(klines) || klines.length === 0) return false;
  // 检查每条 K 线格式：日期,开盘,收盘,最高,最低,成交量
  const sample = klines[0].split(',');
  if (sample.length !== 6) return false;
  if (isNaN(parseFloat(sample[1]))) return false; // 开盘价必须是数字
  return true;
}

// ========== K 线数据抓取 ==========

async function fetchKline(secid, klt, lmt, retries = 4) {
  const params = new URLSearchParams({
    secid, fields1: 'f1,f2,f3', fields2: 'f51,f52,f53,f54,f55,f56',
    klt: String(klt), fqt: '1', end: '20500101', lmt: String(lmt),
    ut: 'fa5fd1402c7fe063136ef88a0db19a9f',
  });
  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      const res = await fetch(`${KLINE_API}?${params}`, { headers: COMMON_HEADERS });
      const text = await res.text();

      if (res.status === 502 || res.status === 503 || res.status === 429) {
        throw new Error(`HTTP ${res.status}（服务端限流）`);
      }
      if (!res.ok) throw new Error(`HTTP ${res.status}，响应：${text.slice(0, 200)}`);
      if (text.startsWith('<')) throw new Error(`API 返回 HTML：${text.slice(0, 200)}`);

      const json = JSON.parse(text);
      if (!json.data?.klines) throw new Error('K线数据异常：' + text.slice(0, 200));
      return { name: json.data.name, klines: json.data.klines };
    } catch (e) {
      if (attempt < retries) {
        const wait = 5000 * attempt + Math.random() * 2000 * attempt;
        console.log(`  ⚠️ K线请求失败（${e.message}），${attempt}/${retries} 重试，等待 ${Math.round(wait/1000)}s...`);
        await sleep(wait);
      } else {
        throw e;
      }
    }
  }
}

// ========== 节假日判断 ==========

// 统一用 UTC 方法计算北京时间，避免浏览器时区差异
function getBeijingNow() {
  const now = new Date();
  const bjMs = now.getTime() + (8 * 60 - now.getTimezoneOffset()) * 60000;
  return new Date(bjMs);
}

function isTradingDay() {
  const bj = getBeijingNow();
  const day = bj.getUTCDay();
  if (day === 0 || day === 6) return false;
  const dateStr = bj.toISOString().slice(0, 10);
  return !HOLIDAYS_2026.has(dateStr);
}

// ========== 历史数据管理 ==========

function saveHistory(dataDir, type, data) {
  const histDir = path.join(dataDir, 'history');
  if (!fs.existsSync(histDir)) fs.mkdirSync(histDir, { recursive: true });

  const bj = getBeijingNow();
  const dateStr = bj.toISOString().slice(0, 10);
  const histFile = path.join(histDir, `${type}-${dateStr}.json`);

  fs.writeFileSync(histFile, JSON.stringify(data));
  console.log(`  📁 历史存档：${type}-${dateStr}.json`);

  // 清理 30 天前的历史文件
  const cutoff = new Date(bj.getTime() - 30 * 86400000).toISOString().slice(0, 10);
  let cleaned = 0;
  fs.readdirSync(histDir).forEach(f => {
    const match = f.match(/-(\d{4}-\d{2}-\d{2})\.json$/);
    if (match && match[1] < cutoff) {
      fs.unlinkSync(path.join(histDir, f));
      cleaned++;
    }
  });
  if (cleaned > 0) console.log(`  🧹 清理 ${cleaned} 个过期历史文件`);
}

// ========== 主流程 ==========

async function main() {
  // 节假日检查
  if (!isTradingDay()) {
    console.log('今天不是交易日，跳过抓取。');
    return;
  }

  // 随机跳过（50% 概率），让抓取间隔在 15~45 分钟之间随机分布
  if (Math.random() < 0.5) {
    console.log('🎲 本轮随机跳过（下次再抓），避免固定频率被识别。');
    return;
  }

  const dataDir = path.join(__dirname, 'public', 'data');
  if (!fs.existsSync(dataDir)) fs.mkdirSync(dataDir);

  // 板块数据（只抓前端需要的字段 → 转换语义化命名 → 校验）
  for (const [type, filterStr] of Object.entries(SECTOR_TYPES)) {
    console.log(`Fetching ${type}...`);
    try {
      const raw = await fetchAllPages(filterStr, SECTOR_FIELDS.join(','));
      const all = raw.map(transformSector);
      const valid = all.filter(validateSector);
      const rejected = all.length - valid.length;
      if (rejected > 0) console.log(`  ⚠️ 校验拦截 ${rejected} 条异常数据`);
      fs.writeFileSync(path.join(dataDir, `${type}.json`), JSON.stringify(valid, null, 2));
      console.log(`✓ ${type}.json saved (${valid.length} items, ${(fs.statSync(path.join(dataDir, `${type}.json`)).size / 1024).toFixed(0)}KB)`);
      saveHistory(dataDir, type, valid);
    } catch (e) {
      console.error(`❌ ${type} 抓取失败：${e.message}`);
    }
    await sleep(5000 + Math.random() * 3000); // 5~8s 随机延迟（板块数据量大，给服务器喘息时间）
  }

  // 资金流向数据（只取前 100 条 → 校验）
  for (const [type, filterStr] of Object.entries(CAPITAL_FLOW_TYPES)) {
    console.log(`Fetching ${type}...`);
    try {
      const { items: raw } = await fetchPage(filterStr, 'f62', '1', CAPITAL_FIELDS.join(','), 100, 1);
      const all = raw.map(transformCapital);
      const valid = all.filter(validateCapital);
      const rejected = all.length - valid.length;
      if (rejected > 0) console.log(`  ⚠️ 校验拦截 ${rejected} 条异常数据`);
      fs.writeFileSync(path.join(dataDir, `${type}.json`), JSON.stringify(valid, null, 2));
      console.log(`✓ ${type}.json saved (${valid.length} items, ${(fs.statSync(path.join(dataDir, `${type}.json`)).size / 1024).toFixed(0)}KB)`);
      saveHistory(dataDir, type, valid);
    } catch (e) {
      console.error(`❌ ${type} 抓取失败：${e.message}`);
    }
    await sleep(5000 + Math.random() * 3000); // 5~8s
  }

  // K 线数据（三大指数 × 三种周期 = 9 个文件）
  const klineConfigs = [
    { klt: 101, lmt: 120, suffix: 'daily' },
    { klt: 102, lmt: 52, suffix: 'weekly' },
    { klt: 1, lmt: 240, suffix: 'minute' },
  ];
  for (const idx of KLINE_INDICES) {
    for (const { klt, lmt, suffix } of klineConfigs) {
      console.log(`Fetching ${idx.id}-${suffix}...`);
      try {
        const data = await fetchKline(idx.secid, klt, lmt);
        if (!validateKline(data.klines)) {
          console.log(`  ❌ K线数据校验失败，跳过保存`);
        } else {
          fs.writeFileSync(path.join(dataDir, `${idx.id}-${suffix}.json`), JSON.stringify(data));
          console.log(`✓ ${idx.id}-${suffix}.json saved (${data.klines.length} items)`);
        }
      } catch (e) {
        console.error(`❌ ${idx.id}-${suffix} 抓取失败：${e.message}`);
      }
      await sleep(3000 + Math.random() * 2000); // 3~5s
    }
  }

  console.log('\nDone!');
}

main().catch(error => {
  console.error('Error:', error.message);
  process.exit(1);
});

#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

const EASTMONEY_API = 'https://push2.eastmoney.com/api/qt/clist/get';

const SECTOR_TYPES = {
  industry: 'm:90 t:2',
  concept: 'm:90 t:3',
  region: 'm:90 t:1',
};

const CAPITAL_FLOW_TYPES = {
  'capital-industry': 'm:90 t:2',
  'capital-concept': 'm:90 t:3',
};

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

async function fetchPage(filterStr, fid, sort, fields, pageSize, page, retries = 3) {
  const params = new URLSearchParams({
    fs: filterStr, fid, po: sort,
    pz: String(pageSize), pn: String(page),
    np: '1', fltt: '2', invt: '2', fields,
  });
  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      const res = await fetch(`${EASTMONEY_API}?${params}`, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
          'Referer': 'https://quote.eastmoney.com/',
        },
      });
      const json = await res.json();
      if (!json.data?.diff) throw new Error(`第 ${page} 页 API 数据异常`);
      return { items: json.data.diff, total: json.data.total };
    } catch (e) {
      if (attempt < retries) {
        console.log(`  ⚠️ 第 ${page} 页请求失败（${e.message}），${attempt}/${retries} 重试...`);
        await new Promise(r => setTimeout(r, 2000 * attempt));
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

// ========== 节假日判断 ==========

function isTradingDay() {
  const now = new Date();
  const utc = now.getTime() + now.getTimezoneOffset() * 60000;
  const bj = new Date(utc + 8 * 3600000);
  const day = bj.getDay();
  if (day === 0 || day === 6) return false;
  const dateStr = bj.toISOString().slice(0, 10);
  return !HOLIDAYS_2026.has(dateStr);
}

// ========== 历史数据管理 ==========

function saveHistory(dataDir, type, data) {
  const histDir = path.join(dataDir, 'history');
  if (!fs.existsSync(histDir)) fs.mkdirSync(histDir, { recursive: true });

  const now = new Date();
  const utc = now.getTime() + now.getTimezoneOffset() * 60000;
  const bj = new Date(utc + 8 * 3600000);
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

  const dataDir = path.join(__dirname, 'data');
  if (!fs.existsSync(dataDir)) fs.mkdirSync(dataDir);

  // 板块数据（只抓前端需要的字段 → 转换语义化命名）
  for (const [type, filterStr] of Object.entries(SECTOR_TYPES)) {
    console.log(`Fetching ${type}...`);
    const raw = await fetchAllPages(filterStr, SECTOR_FIELDS.join(','));
    const data = raw.map(transformSector);
    fs.writeFileSync(path.join(dataDir, `${type}.json`), JSON.stringify(data, null, 2));
    console.log(`✓ ${type}.json saved (${data.length} items, ${(fs.statSync(path.join(dataDir, `${type}.json`)).size / 1024).toFixed(0)}KB)`);
    saveHistory(dataDir, type, data);
  }

  // 资金流向数据（只取前 100 条，不需要分页全量抓）
  for (const [type, filterStr] of Object.entries(CAPITAL_FLOW_TYPES)) {
    console.log(`Fetching ${type}...`);
    const { items: raw } = await fetchPage(filterStr, 'f62', '1', CAPITAL_FIELDS.join(','), 100, 1);
    const data = raw.map(transformCapital);
    fs.writeFileSync(path.join(dataDir, `${type}.json`), JSON.stringify(data, null, 2));
    console.log(`✓ ${type}.json saved (${data.length} items, ${(fs.statSync(path.join(dataDir, `${type}.json`)).size / 1024).toFixed(0)}KB)`);
    saveHistory(dataDir, type, data);
  }

  console.log('\nDone!');
}

main().catch(error => {
  console.error('Error:', error.message);
  process.exit(1);
});

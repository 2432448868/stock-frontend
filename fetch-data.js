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

async function fetchPage(filterStr, fid, sort, fields, pageSize, page) {
  const params = new URLSearchParams({
    fs: filterStr,
    fid,
    po: sort,
    pz: String(pageSize),
    pn: String(page),
    np: '1',
    fltt: '2',
    invt: '2',
    fields,
  });

  const response = await fetch(`${EASTMONEY_API}?${params}`, {
    headers: {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
      'Referer': 'https://quote.eastmoney.com/',
    },
  });

  const json = await response.json();
  if (!json.data || !json.data.diff) {
    throw new Error(`第 ${page} 页 API 数据异常`);
  }
  return { items: json.data.diff, total: json.data.total };
}

async function fetchSectorData(type) {
  const filterStr = SECTOR_TYPES[type];
  const pageSize = 100;
  let allItems = [];
  let page = 1;
  let total = Infinity;

  while (allItems.length < total) {
    const { items, total: t } = await fetchPage(
      filterStr, 'f3', '1',
      'f1,f2,f3,f4,f12,f14,f15,f16,f17,f18,f20,f21,f104,f105,f106,f107,f128,f136,f140,f141',
      pageSize, page
    );
    total = t;
    allItems = allItems.concat(items);
    console.log(`  第 ${page} 页：获取 ${items.length} 条（总计 ${total}）`);
    if (items.length < pageSize) break;
    page++;
  }
  return allItems;
}

async function fetchCapitalFlow(type) {
  const filterStr = CAPITAL_FLOW_TYPES[type];
  // 按主力净流入降序，取前 100
  const { items } = await fetchPage(
    filterStr, 'f62', '1',
    'f12,f14,f2,f3,f62,f184,f66,f69,f72,f75,f78,f81,f104,f105',
    100, 1
  );
  return items;
}

async function main() {
  const dataDir = path.join(__dirname, 'data');
  if (!fs.existsSync(dataDir)) {
    fs.mkdirSync(dataDir);
  }

  // 板块数据
  for (const type of Object.keys(SECTOR_TYPES)) {
    console.log(`Fetching ${type}...`);
    const data = await fetchSectorData(type);
    fs.writeFileSync(path.join(dataDir, `${type}.json`), JSON.stringify(data, null, 2));
    console.log(`✓ ${type}.json saved (${data.length} items)`);
  }

  // 资金流向数据
  for (const type of Object.keys(CAPITAL_FLOW_TYPES)) {
    console.log(`Fetching ${type}...`);
    const data = await fetchCapitalFlow(type);
    fs.writeFileSync(path.join(dataDir, `${type}.json`), JSON.stringify(data, null, 2));
    console.log(`✓ ${type}.json saved (${data.length} items)`);
  }

  console.log('\nDone!');
}

main().catch(error => {
  console.error('Error:', error.message);
  process.exit(1);
});

#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

const EASTMONEY_API = 'https://push2.eastmoney.com/api/qt/clist/get';

const SECTOR_TYPES = {
  industry: 'm:90 t:2',
  concept: 'm:90 t:3',
  region: 'm:90 t:1',
};

async function fetchSectorData(type) {
  const filterStr = SECTOR_TYPES[type];
  const pageSize = 100; // 东方财富 API 单页上限 100
  let allItems = [];
  let page = 1;
  let total = Infinity;

  while (allItems.length < total) {
    const params = new URLSearchParams({
      fs: filterStr,
      fid: 'f3',
      po: '1',
      pz: String(pageSize),
      pn: String(page),
      np: '1',
      fltt: '2',
      invt: '2',
      fields: 'f1,f2,f3,f4,f12,f14,f15,f16,f17,f18,f20,f21,f104,f105,f106,f107,f128,f136,f140,f141',
    });

    const response = await fetch(`${EASTMONEY_API}?${params}`, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        'Referer': 'https://quote.eastmoney.com/',
      },
    });

    const json = await response.json();

    if (!json.data || !json.data.diff) {
      throw new Error(`${type}: 第 ${page} 页 API 数据异常`);
    }

    total = json.data.total;
    allItems = allItems.concat(json.data.diff);
    console.log(`  第 ${page} 页：获取 ${json.data.diff.length} 条（总计 ${total}）`);

    if (json.data.diff.length < pageSize) break; // 最后一页
    page++;
  }

  return allItems;
}

async function main() {
  const dataDir = path.join(__dirname, 'data');
  if (!fs.existsSync(dataDir)) {
    fs.mkdirSync(dataDir);
  }

  for (const type of Object.keys(SECTOR_TYPES)) {
    console.log(`Fetching ${type}...`);
    const data = await fetchSectorData(type);
    fs.writeFileSync(
      path.join(dataDir, `${type}.json`),
      JSON.stringify(data, null, 2)
    );
    console.log(`✓ ${type}.json saved (${data.length} items)`);
  }

  console.log('\nDone!');
}

main().catch(error => {
  console.error('Error:', error.message);
  process.exit(1);
});

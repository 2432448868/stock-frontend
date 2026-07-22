// 临时测试脚本：从 GitHub Actions 测试各数据源连通性
const tests = [
  {
    name: 'EastMoney push2 (原用，已知被封)',
    url: 'https://push2.eastmoney.com/api/qt/clist/get?fs=m:90+t:2&fid=f3&po=1&pz=3&pn=1&np=1&fltt=2&invt=2&ut=fa5fd1402c7fe063136ef88a0db19a9f&fields=f12,f14,f3',
    headers: { 'Referer': 'https://quote.eastmoney.com/' },
  },
  {
    name: 'EastMoney datacenter-web',
    url: 'https://datacenter-web.eastmoney.com/api/data/v1/get?reportName=RPT_INDUSTRY_BOARD_RANK&columns=ALL&pageSize=2&source=WEB&client=WEB',
    headers: { 'Referer': 'https://data.eastmoney.com/' },
  },
  {
    name: 'Sina K-line (已知可用)',
    url: 'https://money.finance.sina.com.cn/quotes_service/api/json_v2.php/CN_MarketData.getKLineData?symbol=sh000001&scale=240&ma=no&datalen=3',
    headers: { 'Referer': 'https://finance.sina.com.cn/' },
  },
  {
    name: 'Sina 行业板块',
    url: 'https://vip.stock.finance.sina.com.cn/q/view/newSinaHy.php',
    headers: { 'Referer': 'https://vip.stock.finance.sina.com.cn/' },
  },
  {
    name: 'Tencent qt.gtimg',
    url: 'https://qt.gtimg.cn/q=bk0426',
    headers: { 'Referer': 'https://stockapp.finance.qq.com/' },
  },
  {
    name: 'Tencent push2 (同东方财富域名)',
    url: 'https://push2.eastmoney.com/api/qt/ulist.np/get?fltt=2&fields=f2,f3,f4,f12,f14&secids=1.000001,0.399001,0.399006',
    headers: { 'Referer': 'https://quote.eastmoney.com/' },
  },
  {
    name: 'EastMoney push2his (K线域名)',
    url: 'https://push2his.eastmoney.com/api/qt/stock/kline/get?secid=1.000001&fields1=f1,f2,f3&fields2=f51,f52,f53,f54,f55,f56&klt=101&fqt=1&end=20500101&lmt=3&ut=fa5fd1402c7fe063136ef88a0db19a9f',
    headers: { 'Referer': 'https://quote.eastmoney.com/' },
  },
];

async function run() {
  console.log('=== 数据源连通性测试（GitHub Actions 环境）===\n');
  for (const t of tests) {
    try {
      const start = Date.now();
      const res = await fetch(t.url, {
        headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36', ...t.headers },
        signal: AbortSignal.timeout(10000),
      });
      const text = await res.text();
      const isJson = text.startsWith('{') || text.startsWith('[');
      const isHtml = text.startsWith('<');
      const hasData = isJson && text.length > 150;
      const emoji = hasData ? '✅' : isHtml ? '❌HTML' : res.ok ? '⚠️空' : '';
      console.log(`${emoji} ${t.name}`);
      console.log(`   HTTP ${res.status} | ${text.length} bytes | ${Date.now() - start}ms`);
      if (text.length > 0 && text.length < 300) console.log(`   内容: ${text.slice(0, 150)}`);
      console.log();
    } catch (e) {
      console.log(`❌ ${t.name}`);
      console.log(`   错误: ${e.message}\n`);
    }
  }
}

run();

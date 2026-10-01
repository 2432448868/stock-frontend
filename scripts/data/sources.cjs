const { requestJson } = require('./http.cjs');
const { beijingNow } = require('./calendar.cjs');
const HEADERS = { 'User-Agent': 'Mozilla/5.0', Referer: 'https://quote.eastmoney.com/' };
const FILTERS = { industry: 'm:90 t:2', concept: 'm:90 t:3', region: 'm:90 t:1' };
const INDICES = [
  { code: '000001', symbol: 'sh000001', secid: '1.000001', name: '上证指数' },
  { code: '399001', symbol: 'sz399001', secid: '0.399001', name: '深证成指' },
  { code: '399006', symbol: 'sz399006', secid: '0.399006', name: '创业板指' },
];
const FIELDS = 'f12,f14,f3,f4,f20,f104,f105,f128,f136,f62,f184,f66,f72,f124';
function number(raw, field, optional = false) {
  const value = raw[field];
  if (optional && (value === '-' || value == null || value === '')) return null;
  if (value === '-' || value == null || value === '' || !Number.isFinite(Number(value))) {
    throw new Error((raw.f12 || '记录') + ' 字段 ' + field + ' 非有效数值');
  }
  return Number(value);
}

// fltt=2 已输出小数百分比/价格；不得再除100。
// 参照 AKShare stock_board_industry_em.py 的同一 clist 接口字段转换。
async function fetchBoards(type, targetDate) {
  const records = new Map();
  let total;
  let sourceTime = Infinity;
  for (let page = 1; page <= 100; page++) {
    const params = new URLSearchParams({ fs: FILTERS[type], fid: 'f12', po: '0',
      pz: '100', pn: String(page), np: '1', fltt: '2', invt: '2',
      ut: 'fa5fd1402c7fe063136ef88a0db19a9f', fields: FIELDS });
    const json = await requestJson('eastmoney', 'https://push2.eastmoney.com/api/qt/clist/get?' + params, HEADERS);
    const data = json.data;
    const count = Number(data?.total);
    if (!Number.isInteger(count) || count <= 0 || count > 10000 || !data?.diff) throw new Error('板块总数或列表异常');
    if (total !== undefined && count !== total) throw new Error('分页期间板块总数变动，保留旧数据');
    total = count;
    const rows = Array.isArray(data.diff) ? data.diff : Object.values(data.diff);
    if (!rows.length) throw new Error('分页提前结束');
    for (const raw of rows) {
      if (typeof raw.f12 !== 'string' || !/^BK\d+$/.test(raw.f12) || typeof raw.f14 !== 'string' || !raw.f14.trim()) throw new Error('板块身份字段异常');
      if (records.has(raw.f12)) throw new Error('分页出现重复板块 ' + raw.f12);
      const timestamp = number(raw, 'f124') * 1000;
      if (timestamp <= 0 || timestamp > Date.now() + 60000) throw new Error('板块时间戳异常');
      if (beijingNow(new Date(timestamp)).date !== targetDate) throw new Error('板块行情日期不是目标交易日 ' + targetDate);
      sourceTime = Math.min(sourceTime, timestamp);
      const sector = {
        code: raw.f12, name: raw.f14, changePercent: number(raw, 'f3'), changeAmount: number(raw, 'f4'),
        marketCap: number(raw, 'f20'), upCount: number(raw, 'f104'), downCount: number(raw, 'f105'),
        leadingStock: typeof raw.f128 === 'string' ? raw.f128 : '', leadingChange: number(raw, 'f136', true),
      };
      if (Math.abs(sector.changePercent) > 100 || sector.marketCap < 0 ||
          !Number.isInteger(sector.upCount) || sector.upCount < 0 ||
          !Number.isInteger(sector.downCount) || sector.downCount < 0) throw new Error('板块数值范围异常');
      const capital = type === 'region' ? null : {
        code: raw.f12, name: raw.f14, changePercent: sector.changePercent,
        mainNetFlow: number(raw, 'f62'), mainPercent: number(raw, 'f184', true),
        superNetFlow: number(raw, 'f66'), bigNetFlow: number(raw, 'f72'),
        upCount: sector.upCount, downCount: sector.downCount,
      };
      records.set(raw.f12, { sector, capital });
    }
    if (records.size === total) {
      const all = [...records.values()];
      return {
        source: '东方财富', sourceUpdatedAt: new Date(sourceTime).toISOString(),
        sectors: all.map(row => row.sector).sort((a, b) => b.changePercent - a.changePercent),
        capital: type === 'region' ? null : all.map(row => row.capital).sort((a, b) => b.mainNetFlow - a.mainNetFlow),
      };
    }
    if (records.size > total) throw new Error('板块数量超过接口total');
  }
  throw new Error('分页超过安全上限');
}

function validateDaily(raw, targetDate) {
  if (!Array.isArray(raw) || raw.length === 0) throw new Error('K线为空');
  const rows = raw.map(row => {
    const parts = typeof row === 'string' ? row.split(',') : row;
    if (!Array.isArray(parts) || parts.length < 6) throw new Error('K线字段不完整');
    const date = String(parts[0]).slice(0, 10);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || new Date(date + 'T00:00:00Z').toISOString().slice(0, 10) !== date) throw new Error('K线日期异常');
    const values = parts.slice(1, 6).map(value => value == null || String(value).trim() === '' ? NaN : Number(value));
    if (!values.every(Number.isFinite)) throw new Error('K线含非数值');
    const [open, close, high, low, volume] = values;
    if (Math.min(open, close, high, low) <= 0 || volume < 0 ||
        high < Math.max(open, close, low) || low > Math.min(open, close, high)) throw new Error('K线OHLC范围异常');
    return [date, ...values];
  }).sort((a, b) => a[0].localeCompare(b[0]));
  if (new Set(rows.map(row => row[0])).size !== rows.length) throw new Error('K线日期重复');
  const eligible = rows.filter(row => row[0] <= targetDate);
  if (eligible.length < 120 || eligible.at(-1)?.[0] !== targetDate) throw new Error('K线尚未覆盖目标日期或历史不足：' + targetDate);
  return eligible;
}

function weeklyFromDaily(rows) {
  const weeks = new Map();
  for (const [date, open, close, high, low, volume] of rows) {
    const monday = new Date(date + 'T00:00:00Z');
    monday.setUTCDate(monday.getUTCDate() - (monday.getUTCDay() + 6) % 7);
    const key = monday.toISOString().slice(0, 10);
    const week = weeks.get(key);
    if (week) {
      week[0] = date; week[2] = close; week[3] = Math.max(week[3], high);
      week[4] = Math.min(week[4], low); week[5] += volume;
    } else weeks.set(key, [date, open, close, high, low, volume]);
  }
  // 第一周可能只有部分历史，丢弃后保留最近52周。
  const result = [...weeks.values()].slice(1).slice(-52);
  if (result.length < 52) throw new Error('历史日线不足以生成52周K线');
  return result.map(row => row.join(','));
}

async function fetchIndex(index, targetDate) {
  const sources = [
    { key: 'tencent', name: '腾讯财经', load: async () => {
      const json = await requestJson('tencent', 'https://web.ifzq.gtimg.cn/appstock/app/fqkline/get?param=' + index.symbol + ',day,,,400,qfq');
      const data = json.data?.[index.symbol];
      return data?.qfqday || data?.day;
    } },
    { key: 'sina', name: '新浪财经', load: async () => {
      const params = new URLSearchParams({ symbol: index.symbol, scale: '240', ma: 'no', datalen: '400' });
      const data = await requestJson('sina', 'https://money.finance.sina.com.cn/quotes_service/api/json_v2.php/CN_MarketData.getKLineData?' + params,
        { ...HEADERS, Referer: 'https://finance.sina.com.cn/' });
      return Array.isArray(data) ? data.map(row => [row.day, row.open, row.close, row.high, row.low, row.volume]) : null;
    } },
    { key: 'eastmoney', name: '东方财富', load: async () => {
      const params = new URLSearchParams({ secid: index.secid, fields1: 'f1,f2,f3', fields2: 'f51,f52,f53,f54,f55,f56',
        klt: '101', fqt: '1', end: targetDate.replaceAll('-', ''), lmt: '400', ut: 'fa5fd1402c7fe063136ef88a0db19a9f' });
      const json = await requestJson('eastmoney', 'https://push2his.eastmoney.com/api/qt/stock/kline/get?' + params, HEADERS);
      return json.data?.klines;
    } },
  ];
  const errors = [];
  for (const source of sources) {
    try {
      const rows = validateDaily(await source.load(), targetDate);
      const weekly = weeklyFromDaily(rows);
      return { source: source.name, volumeUnit: 'source-native',
        daily: rows.slice(-120).map(row => row.join(',')), weekly };
    } catch (error) {
      errors.push(source.name + ': ' + error.message);
      console.warn(index.code + ' ' + errors.at(-1));
    }
  }
  throw new Error(errors.join('；'));
}
module.exports = { FILTERS, INDICES, fetchBoards, fetchIndex };

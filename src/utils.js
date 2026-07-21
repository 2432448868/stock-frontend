// 常量
export const DATA_PATH = './data';
export const INDICES = [
  { secid: '1.000001', name: '上证指数' },
  { secid: '0.399001', name: '深证成指' },
  { secid: '0.399006', name: '创业板指' },
];

// 本地缓存（错误降级用）
export function saveCache(key, data) {
  try { localStorage.setItem('cache_' + key, JSON.stringify({ data, ts: Date.now() })); } catch (e) {}
}

export function loadCache(key) {
  try {
    const raw = localStorage.getItem('cache_' + key);
    if (!raw) return null;
    const { data, ts } = JSON.parse(raw);
    return { data, stale: Date.now() - ts > 3600000 };
  } catch (e) { return null; }
}

// 金额格式化
export function formatAmount(v) {
  const abs = Math.abs(v);
  const sign = v > 0 ? '+' : v < 0 ? '-' : '';
  if (abs >= 1e12) return sign + (abs / 1e12).toFixed(2) + '万亿';
  if (abs >= 1e8) return sign + (abs / 1e8).toFixed(2) + '亿';
  if (abs >= 1e4) return sign + (abs / 1e4).toFixed(0) + '万';
  return sign + abs.toFixed(0);
}

// 市值格式化
export function formatMarketCap(v) {
  if (v >= 1e12) return (v / 1e12).toFixed(2) + '万亿';
  if (v >= 1e8) return (v / 1e8).toFixed(1) + '亿';
  if (v >= 1e4) return (v / 1e4).toFixed(0) + '万';
  return String(v);
}

// 北京时间：返回一个 Date，使其 getUTCHours/getUTCMinutes 返回北京时间
// 公式：北京时间 = 本地时间 + (8h - 本地时区偏移)
// UTC+8 用户：偏移 = 8×60 + (-480) = 0，本地时间就是北京时间
// UTC-5 用户：偏移 = 8×60 + 300 = 780min = 13h
// UTC+0 用户：偏移 = 8×60 + 0 = 480min = 8h
export function getBeijingNow() {
  const now = new Date();
  return new Date(now.getTime() + (8 * 60 + now.getTimezoneOffset()) * 60000);
}

// 交易时间判断
export function isTradingTime() {
  const bj = getBeijingNow();
  const t = bj.getUTCHours() * 60 + bj.getUTCMinutes();
  return t >= 555 && t <= 905 && bj.getUTCDay() >= 1 && bj.getUTCDay() <= 5;
}

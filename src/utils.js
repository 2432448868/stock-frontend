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

// 北京时间：返回 { hours, minutes, seconds, day, dateStr }
// 使用 Intl API 直接获取 Asia/Shanghai 时区的时间，不依赖时区偏移计算
export function getBeijingNow() {
  const now = new Date();
  const parts = new Intl.DateTimeFormat('zh-CN', {
    timeZone: 'Asia/Shanghai',
    year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', second: '2-digit',
    hour12: false,
  }).formatToParts(now);
  const get = (type) => parts.find(p => p.type === type)?.value;
  const hours = parseInt(get('hour'));
  const minutes = parseInt(get('minute'));
  const seconds = parseInt(get('second'));
  const day = parseInt(get('day'));
  const month = parseInt(get('month'));
  const year = parseInt(get('year'));
  return {
    hours, minutes, seconds, day, month, year,
    dateStr: `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`,
    timeStr: `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`,
  };
}

// 交易时间判断
export function isTradingTime() {
  const bj = getBeijingNow();
  const t = bj.hours * 60 + bj.minutes;
  // 上午 9:15 ~ 11:30，下午 13:00 ~ 15:00，周一到周五
  const isWeekday = bj.day >= 1 && bj.day <= 5;
  return isWeekday && ((t >= 555 && t <= 690) || (t >= 780 && t <= 900));
}

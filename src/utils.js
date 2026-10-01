// 常量
export const DATA_PATH = './data';
export const INDICES = [
  { secid: '1.000001', name: '上证指数' },
  { secid: '0.399001', name: '深证成指' },
  { secid: '0.399006', name: '创业板指' },
];

// 静态数据读取有独立超时；不会触发行情源采集。
export async function fetchSnapshot(name) {
  const res = await fetch(DATA_PATH + '/' + name + '.json?t=' + Date.now(), { signal: AbortSignal.timeout(20000) });
  if (!res.ok) throw new Error('HTTP ' + res.status);
  return res.json();
}

export function escapeHtml(value) {
  return String(value ?? '').replace(/[&<>"']/g, ch => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[ch]));
}

export function describeData(data) {
  if (data.schemaVersion !== 2) return '旧版数据（口径待升级） · 采集 ' + (data.updatedAt || '时间未知');
  return '数据日 ' + data.dataDate + ' · ' +
    (data.freshness === 'verified' ? '次日补采' : '盘后快照，收盘值待确认') +
    ' · ' + data.source + ' · 采集 ' + data.updatedAt;
}

// 统一缓存封装，并兼容旧版多包了一层的缓存。
export function saveCache(key, data) {
  try { localStorage.setItem('cache_' + key, JSON.stringify({ data, ts: Date.now() })); } catch {}
}
export function loadCache(key) {
  try {
    const raw = localStorage.getItem('cache_' + key);
    if (!raw) return null;
    const { data, ts } = JSON.parse(raw);
    const snapshot = Array.isArray(data) ? { data } : data;
    if (!Array.isArray(snapshot?.data) || !Number.isFinite(ts)) return null;
    return { ...snapshot, ts, stale: Date.now() - ts > 3600000 };
  } catch { return null; }
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

// 骨架屏：表格行（shimmer 加载占位）
export function skeletonRows(cols, rows = 6) {
  const cell = `<td><div class="skeleton sk-cell"></div></td>`;
  return Array.from({ length: rows }, () => `<tr class="sk-row">${cell.repeat(cols)}</tr>`).join('');
}

// 骨架屏：洞察卡片网格（2 卡片行 + 1 通栏）
export function insightSkeleton() {
  const card = `<div class="insight-card">
    <div class="skeleton" style="height:14px;width:38%;margin-bottom:14px"></div>
    <div class="skeleton" style="height:26px;width:62%;margin-bottom:10px"></div>
    <div class="skeleton" style="height:12px;width:82%"></div>
  </div>`;
  const full = `<div class="insight-card full">
    <div class="skeleton" style="height:14px;width:24%;margin-bottom:12px"></div>
    <div class="skeleton" style="height:12px;width:90%;margin-bottom:8px"></div>
    <div class="skeleton" style="height:12px;width:70%"></div>
  </div>`;
  return `<div class="insight-grid">${card.repeat(4)}${full}</div>`;
}

// 市值格式化
export function formatMarketCap(v) {
  if (v >= 1e12) return (v / 1e12).toFixed(2) + '万亿';
  if (v >= 1e8) return (v / 1e8).toFixed(1) + '亿';
  if (v >= 1e4) return (v / 1e4).toFixed(0) + '万';
  return String(v);
}

// 数字滚动：easeOutBack 过冲回弹 + 滚动中模糊（聚焦感）+ 落定弹跳
export function countUp(el, to, { duration = 950, from = 0, format = v => String(v) } = {}) {
  if (!el) return;
  const start = performance.now();
  const c1 = 1.24, c3 = c1 + 1;
  const ease = p => 1 + c3 * Math.pow(p - 1, 3) + c1 * Math.pow(p - 1, 2);
  function frame(now) {
    const p = Math.min(1, (now - start) / duration);
    el.textContent = format(from + (to - from) * Math.max(0, ease(p)));
    el.style.filter = p < 1 ? `blur(${((1 - p) ** 2 * 3).toFixed(2)}px)` : '';
    if (p < 1) requestAnimationFrame(frame);
    else {
      el.style.filter = '';
      el.classList.remove('pop');
      void el.offsetWidth; // 强制 reflow，重启动画
      el.classList.add('pop');
    }
  }
  requestAnimationFrame(frame);
}

// 双 rAF：等 DOM 首帧样式生效后再改（用于条形生长动画）
export function nextFrame(fn) {
  requestAnimationFrame(() => requestAnimationFrame(fn));
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
// 用 dateStr（已验证时间正确）构造 Date 来判断星期几，避免 Intl weekday 解析问题
export function isTradingTime() {
  const bj = getBeijingNow();
  const t = bj.hours * 60 + bj.minutes;
  // 用 dateStr 构造 Date 获取星期几（0=周日, 6=周六）
  const dayOfWeek = new Date(bj.dateStr).getDay();
  const isWeekday = dayOfWeek >= 1 && dayOfWeek <= 5;
  // 上午 9:15 ~ 11:30，下午 13:00 ~ 15:00
  return isWeekday && ((t >= 555 && t <= 690) || (t >= 780 && t <= 900));
}

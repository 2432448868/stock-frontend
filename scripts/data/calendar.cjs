// 上交所2026休市公告：https://www.sse.com.cn/disclosure/announcement/general/c/c_20251222_10802507.shtml
// 新年份必须显式维护，未知年份拒绝抓取，避免把节假日当交易日。
const HOLIDAYS = {
  2025: [
    ['01-01', '01-01'], ['01-28', '02-04'], ['04-04', '04-06'],
    ['05-01', '05-05'], ['05-31', '06-02'], ['10-01', '10-08'],
  ],
  2026: [
    ['01-01', '01-03'], ['02-15', '02-23'], ['04-04', '04-06'],
    ['05-01', '05-05'], ['06-19', '06-21'], ['09-25', '09-27'], ['10-01', '10-07'],
  ],
};
function beijingNow(date = new Date()) {
  const parts = new Intl.DateTimeFormat('sv-SE', {
    timeZone: 'Asia/Shanghai', year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', second: '2-digit', hourCycle: 'h23',
  }).formatToParts(date);
  const get = type => parts.find(part => part.type === type).value;
  return { date: get('year') + '-' + get('month') + '-' + get('day'),
    time: get('hour') + ':' + get('minute') + ':' + get('second') };
}
function isTradingDay(date) {
  const year = date.slice(0, 4);
  if (!HOLIDAYS[year]) throw new Error('未配置 ' + year + ' 年交易日历，请先维护 calendar.cjs');
  const day = new Date(date + 'T00:00:00Z').getUTCDay();
  return day !== 0 && day !== 6 && !HOLIDAYS[year].some(([start, end]) =>
    date >= year + '-' + start && date <= year + '-' + end);
}
function previousTradingDay(date) {
  const cursor = new Date(date + 'T00:00:00Z');
  for (let i = 0; i < 40; i++) {
    cursor.setUTCDate(cursor.getUTCDate() - 1);
    const candidate = cursor.toISOString().slice(0, 10);
    if (isTradingDay(candidate)) return candidate;
  }
  throw new Error('找不到上一交易日');
}
module.exports = { beijingNow, isTradingDay, previousTradingDay };

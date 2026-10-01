const TIMEOUT_MS = 20000;
const MAX_ATTEMPTS = 3;
const BACKOFF_MS = [60000, 180000];
const MAX_SERVER_WAIT_MS = 5 * 60000;
const states = new Map();
const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));
const jitter = () => Math.floor(Math.random() * 10000);

function retryAfter(value) {
  if (!value) return 0;
  const seconds = Number(value);
  return Math.max(0, Number.isFinite(seconds) ? seconds * 1000 : Date.parse(value) - Date.now()) || 0;
}

// 调用方串行 await；按供应商限速，而非按域名绕开限流。
async function requestJson(source, url, headers = {}) {
  if (!states.has(source)) states.set(source, { nextAt: 0, limited: 0, open: false });
  const state = states.get(source);
  for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt++) {
    if (state.open) throw new Error(source + ' 本轮已熔断，不再请求');
    await sleep(Math.max(0, state.nextAt - Date.now()));
    let serverWait = 0;
    let permanent = false;
    try {
      const res = await fetch(url, { headers, signal: AbortSignal.timeout(TIMEOUT_MS) });
      serverWait = retryAfter(res.headers.get('retry-after'));
      if (!res.ok) {
        const limited = [403, 429, 502, 503].includes(res.status);
        state.limited = limited ? state.limited + 1 : 0;
        // 明确拒绝访问不再重试；连续两次限流熔断该供应商。
        if (res.status === 403 || state.limited >= 2 || serverWait > MAX_SERVER_WAIT_MS) state.open = true;
        permanent = res.status >= 400 && res.status < 500 && ![408, 429].includes(res.status);
        await res.body?.cancel();
        throw new Error('HTTP ' + res.status);
      }
      const json = await res.json();
      state.limited = 0;
      return json;
    } catch (error) {
      if (state.open || permanent || attempt === MAX_ATTEMPTS - 1) {
        // 连续耗尽预算也停源，避免每个板块重复失败三遍。
        state.open = true;
        throw new Error(source + ': ' + error.message);
      }
      const wait = Math.max(BACKOFF_MS[attempt] + jitter(), serverWait);
      console.warn(source + ' 请求失败，第' + (attempt + 1) + '次；等待 ' + Math.ceil(wait / 1000) + '秒：' + error.message);
      state.nextAt = Date.now() + wait;
    } finally {
      state.nextAt = Math.max(state.nextAt, Date.now() + 10000 + jitter());
    }
  }
}
module.exports = { requestJson };

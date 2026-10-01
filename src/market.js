import { state } from './state.js';
import { fetchSnapshot, describeData, INDICES, countUp } from './utils.js';

let chartRequest = 0;
let cardsRequest = 0;
let echartsPromise = null;

async function loadKline(secid, klt) {
  const key = secid + '_' + klt;
  const cache = state.klineCache;
  if (cache[key]) return cache[key];
  const suffix = klt === '102' ? 'weekly' : 'daily';
  const data = await fetchSnapshot('kline-' + secid.split('.')[1] + '-' + suffix);
  if (!Array.isArray(data.klines) || !data.klines.length) throw new Error('K线数据为空');
  cache[key] = { data: { name: data.name, klines: data.klines },
    time: describeData(data), date: data.dataDate || data.updatedAt || '日期未知' };
  return cache[key];
}

function renderIndexCards(klineData) {
  document.querySelectorAll('.index-card').forEach((card, i) => {
    const kl = klineData[i]?.data?.klines;
    if (!kl?.length) return;
    let time = card.querySelector('.index-data-time');
    if (!time) {
      time = document.createElement('div');
      time.className = 'index-data-time data-time';
      card.appendChild(time);
    }
    time.textContent = '数据日 ' + klineData[i].date;
    card.title = klineData[i].time;
    const latest = kl[kl.length - 1].split(',');
    const prev = kl.length > 1 ? parseFloat(kl[kl.length - 2].split(',')[2]) : parseFloat(latest[1]);
    const close = parseFloat(latest[2]);
    const change = close - prev;
    const changePct = (change / prev) * 100;
    const cls = change > 0 ? 'up' : change < 0 ? 'down' : 'flat';
    const sign = change > 0 ? '+' : '';
    // 数据刷新时红/绿背景闪动一下
    const lastClose = parseFloat(card.dataset.close || '0');
    const priceEl = card.querySelector('.price');
    priceEl.className = 'price ' + cls;
    if (!lastClose) {
      // 首次渲染：数字从 0 滚上来
      countUp(priceEl, close, { duration: 900, format: v => v.toFixed(2) });
    } else {
      priceEl.textContent = close.toFixed(2);
      if (close !== lastClose) {
        priceEl.classList.remove('flash-up', 'flash-down');
        void priceEl.offsetWidth; // 强制 reflow 重启动画
        priceEl.classList.add(close > lastClose ? 'flash-up' : 'flash-down');
      }
    }
    card.dataset.close = close;
    card.querySelector('.change').className = 'change ' + cls;
    card.querySelector('.change').textContent = `${sign}${change.toFixed(2)}  ${sign}${changePct.toFixed(2)}%`;
  });
}

function loadECharts() {
  if (state.echartsReady) return Promise.resolve();
  if (echartsPromise) return echartsPromise;
  echartsPromise = new Promise((resolve, reject) => {
    const el = document.createElement('script');
    const timeout = setTimeout(() => { el.remove(); reject(new Error('图表组件加载超时，请重新打开大盘页')); }, 20000);
    el.src = 'https://cdn.jsdelivr.net/npm/echarts@5/dist/echarts.min.js';
    el.onload = () => { clearTimeout(timeout); state.echartsReady = true; resolve(); };
    el.onerror = () => { clearTimeout(timeout); el.remove(); reject(new Error('图表组件加载失败，请重新打开大盘页')); };
    document.head.appendChild(el);
  }).catch(error => { echartsPromise = null; throw error; });
  return echartsPromise;
}

export function initChart() {
  if (state.chart) return;
  const isLight = document.documentElement.getAttribute('data-theme') === 'light';
  state.chart = echarts.init(document.getElementById('klineChart'), isLight ? undefined : 'dark');
  window.addEventListener('resize', () => state.chart?.resize());
  loadChartData(state.selectedIdx, state.currentKlt);
}

async function loadChartData(idx, klt) {
  if (!state.chart) return;
  const request = ++chartRequest;
  const chart = state.chart;
  const isLight = document.documentElement.getAttribute('data-theme') === 'light';
  state.chart.showLoading({ text: '加载中...', color: '#f0b429', textColor: isLight ? '#282430' : '#f0eef4', maskColor: isLight ? 'rgba(250,248,244,.8)' : 'rgba(23,22,27,.8)' });
  try {
    const result = await loadKline(INDICES[idx].secid, klt);
    if (request !== chartRequest || chart !== state.chart) return;
    state.klineTime = result.time;
    const klines = result.data.klines.map(k => k.split(','));
    const dates = klines.map(k => k[0]);
    const closes = klines.map(k => +k[2]);
    const opens = klines.map(k => +k[1]);
    const volumes = klines.map(k => +k[5]);

    // 主题感知色板：亮色用暖灰浅线，暗色用暖炭深线
    const pal = isLight
      ? { tipBg: '#ffffff', tipBorder: '#e8e3d8', tipText: '#282430', axis: '#e8e3d8', label: '#8d8898', split: '#efece4', dzBorder: '#e8e3d8' }
      : { tipBg: '#1f1e25', tipBorder: '#2b2933', tipText: '#f0eef4', axis: '#2b2933', label: '#93909f', split: '#24232b', dzBorder: '#2b2933' };
    const tooltipStyle = { backgroundColor: pal.tipBg, borderColor: pal.tipBorder, textStyle: { color: pal.tipText, fontSize: 12, fontFamily: "'Space Grotesk Variable','PingFang SC','Microsoft YaHei',sans-serif" } };

    const ohlc = klines.map(k => [+k[1], +k[2], +k[4], +k[3]]);
    state.chart.setOption({
      backgroundColor: 'transparent',
      animationDuration: idx => 260 + Math.min(idx * 14, 1100),
      animationEasing: 'cubicOut',
      animationDurationUpdate: 250,
      tooltip: { trigger: 'axis', ...tooltipStyle },
      grid: [{ left: 60, right: 20, top: 20, height: '60%' }, { left: 60, right: 20, top: '78%', height: '16%' }],
      xAxis: [
        { type: 'category', data: dates, gridIndex: 0, axisLine: { lineStyle: { color: pal.axis } }, axisLabel: { color: pal.label, fontSize: 10 }, boundaryGap: true },
        { type: 'category', data: dates, gridIndex: 1, axisLine: { lineStyle: { color: pal.axis } }, axisLabel: { show: false }, boundaryGap: true },
      ],
      yAxis: [
        { type: 'value', gridIndex: 0, splitLine: { lineStyle: { color: pal.split } }, axisLabel: { color: pal.label, fontSize: 10 }, scale: true },
        { type: 'value', gridIndex: 1, splitLine: { show: false }, axisLabel: { show: false }, scale: true },
      ],
      dataZoom: [
        { type: 'inside', xAxisIndex: [0, 1], start: klt === '102' ? 0 : 60, end: 100 },
        { type: 'slider', xAxisIndex: [0, 1], bottom: 5, height: 16, borderColor: pal.dzBorder, fillerColor: 'rgba(240,180,41,.15)', handleStyle: { color: '#f0b429' }, textStyle: { color: pal.label } },
      ],
      series: [
        { name: 'K线', type: 'candlestick', data: ohlc, xAxisIndex: 0, yAxisIndex: 0, itemStyle: { color: '#ff6b5e', color0: '#3ecf8e', borderColor: '#ff6b5e', borderColor0: '#3ecf8e' } },
        { name: '成交量', type: 'bar', data: volumes.map((v, i) => ({ value: v, itemStyle: { color: closes[i] >= opens[i] ? 'rgba(255,107,94,.5)' : 'rgba(62,207,142,.5)' } })), xAxisIndex: 1, yAxisIndex: 1 },
      ],
    }, true);

    state.chart.hideLoading();
    // 更新 K 线时间戳
    const timeEl = document.getElementById('klineTime');
    if (timeEl && state.klineTime) timeEl.textContent = state.klineTime + ' · 成交量为源原始单位，切源不宜直接比较';
  } catch (e) {
    if (request !== chartRequest || chart !== state.chart) return;
    document.getElementById('klineTime').textContent = 'K线加载失败；图中若有曲线则为上次快照：' + e.message;
    state.chart.hideLoading();
    console.error('K线加载失败:', e);
  }
}

// 事件绑定
function bindEvents() {
  document.querySelectorAll('.index-card').forEach(card => {
    card.addEventListener('click', () => {
      document.querySelectorAll('.index-card').forEach(c => c.classList.remove('selected'));
      card.classList.add('selected');
      state.selectedIdx = parseInt(card.dataset.idx);
      state.klineCache = {};
      loadChartData(state.selectedIdx, state.currentKlt);
    });
  });

  document.querySelectorAll('.chart-btn[data-klt]').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.chart-btn[data-klt]').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      state.currentKlt = btn.dataset.klt;
      state.klineCache = {};
      loadChartData(state.selectedIdx, state.currentKlt);
    });
  });
}

// 初始化
async function loadIndexCards() {
  const request = ++cardsRequest;
  const results = await Promise.allSettled(INDICES.map(idx => loadKline(idx.secid, '101')));
  if (request !== cardsRequest) return;
  renderIndexCards(results.map(result => result.status === 'fulfilled' ? result.value : null));
  results.forEach((result, i) => {
    if (result.status === 'rejected') {
      const card = document.querySelectorAll('.index-card')[i];
      card.title = '指数加载失败，保留旧快照';
      let notice = card.querySelector('.index-data-time');
      if (!notice) { notice = document.createElement('div'); notice.className = 'index-data-time data-time'; card.appendChild(notice); }
      notice.textContent = '加载失败 · 旧值请勿视为最新';
    }
  });
}
export async function initMarket() {
  bindEvents();
  await loadIndexCards();
}

// 供外部调用（主题切换时重建图表）
export function rebuildChart() {
  if (state.chart && state.echartsReady) {
    const isLight = document.documentElement.getAttribute('data-theme') === 'light';
    state.chart.dispose();
    state.chart = echarts.init(document.getElementById('klineChart'), isLight ? undefined : 'dark');
    state.klineCache = {};
    loadChartData(state.selectedIdx, state.currentKlt);
  }
}

// 导航到大盘 Tab 时懒加载 ECharts
export function onMarketTabOpen() {
  if (!state.chart) loadECharts().then(initChart).catch(error => {
    document.getElementById('klineTime').textContent = error.message;
  });
  else state.chart.resize();
}

// 自动刷新时清空缓存
export async function refreshMarket() {
  state.klineCache = {};
  await Promise.allSettled([loadIndexCards(), loadChartData(state.selectedIdx, state.currentKlt)]);
}

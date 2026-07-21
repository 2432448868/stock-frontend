import { state } from './state.js';
import { DATA_PATH, INDICES } from './utils.js';

// 从 JSON 文件加载 K 线数据
async function loadKline(secid, klt) {
  const key = secid + '_' + klt;
  if (state.klineCache[key]) return state.klineCache[key];
  const suffix = klt === '1' ? 'minute' : klt === '102' ? 'weekly' : 'daily';
  const idxCode = secid.split('.')[1];
  const res = await fetch(`${DATA_PATH}/kline-${idxCode}-${suffix}.json?t=${Date.now()}`);
  if (!res.ok) throw new Error(`K线数据加载失败: HTTP ${res.status}`);
  const data = await res.json();
  state.klineCache[key] = { data: { name: data.name, klines: data.klines } };
  return state.klineCache[key];
}

function renderIndexCards(klineData) {
  document.querySelectorAll('.index-card').forEach((card, i) => {
    const kl = klineData[i]?.data?.klines;
    if (!kl?.length) return;
    const latest = kl[kl.length - 1].split(',');
    const prev = kl.length > 1 ? parseFloat(kl[kl.length - 2].split(',')[2]) : parseFloat(latest[1]);
    const close = parseFloat(latest[2]);
    const change = close - prev;
    const changePct = (change / prev) * 100;
    const cls = change > 0 ? 'up' : change < 0 ? 'down' : 'flat';
    const sign = change > 0 ? '+' : '';
    card.querySelector('.price').className = 'price ' + cls;
    card.querySelector('.price').textContent = close.toFixed(2);
    card.querySelector('.change').className = 'change ' + cls;
    card.querySelector('.change').textContent = `${sign}${change.toFixed(2)}  ${sign}${changePct.toFixed(2)}%`;
  });
}

function loadECharts() {
  if (state.echartsReady) return Promise.resolve();
  return new Promise((resolve, reject) => {
    const el = document.createElement('script');
    el.src = 'https://cdn.jsdelivr.net/npm/echarts@5/dist/echarts.min.js';
    el.onload = () => { state.echartsReady = true; resolve(); };
    el.onerror = () => reject(new Error('ECharts 加载失败'));
    document.head.appendChild(el);
  });
}

export function initChart() {
  const isLight = document.documentElement.getAttribute('data-theme') === 'light';
  state.chart = echarts.init(document.getElementById('klineChart'), isLight ? undefined : 'dark');
  window.addEventListener('resize', () => state.chart?.resize());
  loadChartData(state.selectedIdx, state.currentKlt);
}

async function loadChartData(idx, klt) {
  if (!state.chart) return;
  const isLight = document.documentElement.getAttribute('data-theme') === 'light';
  state.chart.showLoading({ text: '加载中...', color: '#2563eb', textColor: isLight ? '#1f2328' : '#e6edf3', maskColor: isLight ? 'rgba(240,242,245,.8)' : 'rgba(13,17,23,.8)' });
  try {
    const result = await loadKline(INDICES[idx].secid, klt);
    const klines = result.data.klines.map(k => k.split(','));
    const dates = klines.map(k => k[0]);
    const closes = klines.map(k => +k[2]);
    const opens = klines.map(k => +k[1]);
    const volumes = klines.map(k => +k[5]);

    if (klt === '1') {
      state.chart.setOption({
        backgroundColor: 'transparent',
        tooltip: { trigger: 'axis', backgroundColor: '#161b22', borderColor: '#30363d', textStyle: { color: '#e6edf3', fontSize: 12 } },
        grid: [{ left: 60, right: 20, top: 20, height: '60%' }, { left: 60, right: 20, top: '78%', height: '16%' }],
        xAxis: [
          { type: 'category', data: dates, gridIndex: 0, axisLine: { lineStyle: { color: '#30363d' } }, axisLabel: { color: '#8b949e', fontSize: 10 }, boundaryGap: false },
          { type: 'category', data: dates, gridIndex: 1, axisLine: { lineStyle: { color: '#30363d' } }, axisLabel: { show: false }, boundaryGap: false },
        ],
        yAxis: [
          { type: 'value', gridIndex: 0, splitLine: { lineStyle: { color: '#21262d' } }, axisLabel: { color: '#8b949e', fontSize: 10 }, scale: true },
          { type: 'value', gridIndex: 1, splitLine: { show: false }, axisLabel: { show: false }, scale: true },
        ],
        series: [
          { name: '价格', type: 'line', data: closes, xAxisIndex: 0, yAxisIndex: 0, smooth: true, symbol: 'none', lineStyle: { color: '#2563eb', width: 2 }, areaStyle: { color: new echarts.graphic.LinearGradient(0, 0, 0, 1, [{ offset: 0, color: 'rgba(37,99,235,.3)' }, { offset: 1, color: 'rgba(37,99,235,.02)' }]) } },
          { name: '成交量', type: 'bar', data: volumes.map((v, i) => ({ value: v, itemStyle: { color: closes[i] >= opens[i] ? 'rgba(255,77,79,.4)' : 'rgba(0,185,107,.4)' } })), xAxisIndex: 1, yAxisIndex: 1 },
        ],
      }, true);
    } else {
      const ohlc = klines.map(k => [+k[1], +k[2], +k[4], +k[3]]);
      state.chart.setOption({
        backgroundColor: 'transparent',
        tooltip: { trigger: 'axis', backgroundColor: '#161b22', borderColor: '#30363d', textStyle: { color: '#e6edf3', fontSize: 12 } },
        grid: [{ left: 60, right: 20, top: 20, height: '60%' }, { left: 60, right: 20, top: '78%', height: '16%' }],
        xAxis: [
          { type: 'category', data: dates, gridIndex: 0, axisLine: { lineStyle: { color: '#30363d' } }, axisLabel: { color: '#8b949e', fontSize: 10 }, boundaryGap: true },
          { type: 'category', data: dates, gridIndex: 1, axisLine: { lineStyle: { color: '#30363d' } }, axisLabel: { show: false }, boundaryGap: true },
        ],
        yAxis: [
          { type: 'value', gridIndex: 0, splitLine: { lineStyle: { color: '#21262d' } }, axisLabel: { color: '#8b949e', fontSize: 10 }, scale: true },
          { type: 'value', gridIndex: 1, splitLine: { show: false }, axisLabel: { show: false }, scale: true },
        ],
        dataZoom: [
          { type: 'inside', xAxisIndex: [0, 1], start: klt === '102' ? 0 : 60, end: 100 },
          { type: 'slider', xAxisIndex: [0, 1], bottom: 5, height: 16, borderColor: '#30363d', fillerColor: 'rgba(37,99,235,.15)', handleStyle: { color: '#2563eb' }, textStyle: { color: '#8b949e' } },
        ],
        series: [
          { name: 'K线', type: 'candlestick', data: ohlc, xAxisIndex: 0, yAxisIndex: 0, itemStyle: { color: '#ff4d4f', color0: '#00b96b', borderColor: '#ff4d4f', borderColor0: '#00b96b' } },
          { name: '成交量', type: 'bar', data: volumes.map((v, i) => ({ value: v, itemStyle: { color: closes[i] >= opens[i] ? 'rgba(255,77,79,.5)' : 'rgba(0,185,107,.5)' } })), xAxisIndex: 1, yAxisIndex: 1 },
        ],
      }, true);
    }
    state.chart.hideLoading();
  } catch (e) {
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
export async function initMarket() {
  bindEvents();
  try {
    const results = await Promise.all(INDICES.map(idx => loadKline(idx.secid, '101')));
    renderIndexCards(results);
  } catch (e) { console.error('指数数据加载失败:', e); }
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
  if (!state.chart) loadECharts().then(initChart);
}

// 自动刷新时清空缓存
export function refreshMarket() {
  state.klineCache = {};
}

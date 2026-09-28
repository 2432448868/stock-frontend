import { state } from './state.js';
import { DATA_PATH, INDICES, countUp } from './utils.js';

// 从 JSON 文件加载 K 线数据
async function loadKline(secid, klt) {
  const key = secid + '_' + klt;
  if (state.klineCache[key]) return state.klineCache[key];
  const suffix = klt === '1' ? 'minute' : klt === '102' ? 'weekly' : 'daily';
  const idxCode = secid.split('.')[1];
  const res = await fetch(`${DATA_PATH}/kline-${idxCode}-${suffix}.json?t=${Date.now()}`);
  if (!res.ok) throw new Error(`K线数据加载失败: HTTP ${res.status}`);
  const data = await res.json();
  const klineData = { name: data.name, klines: data.klines };
  state.klineTime = data.updatedAt || state.klineTime;
  state.klineCache[key] = { data: klineData };
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
  state.chart.showLoading({ text: '加载中...', color: '#f0b429', textColor: isLight ? '#282430' : '#f0eef4', maskColor: isLight ? 'rgba(250,248,244,.8)' : 'rgba(23,22,27,.8)' });
  try {
    const result = await loadKline(INDICES[idx].secid, klt);
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

    if (klt === '1') {
      state.chart.setOption({
        backgroundColor: 'transparent',
        animationDuration: idx => 260 + Math.min(idx * 14, 1100),
        animationEasing: 'cubicOut',
        animationDurationUpdate: 250,
        tooltip: { trigger: 'axis', ...tooltipStyle },
        grid: [{ left: 60, right: 20, top: 20, height: '60%' }, { left: 60, right: 20, top: '78%', height: '16%' }],
        xAxis: [
          { type: 'category', data: dates, gridIndex: 0, axisLine: { lineStyle: { color: pal.axis } }, axisLabel: { color: pal.label, fontSize: 10 }, boundaryGap: false },
          { type: 'category', data: dates, gridIndex: 1, axisLine: { lineStyle: { color: pal.axis } }, axisLabel: { show: false }, boundaryGap: false },
        ],
        yAxis: [
          { type: 'value', gridIndex: 0, splitLine: { lineStyle: { color: pal.split } }, axisLabel: { color: pal.label, fontSize: 10 }, scale: true },
          { type: 'value', gridIndex: 1, splitLine: { show: false }, axisLabel: { show: false }, scale: true },
        ],
        series: [
          { name: '价格', type: 'line', data: closes, xAxisIndex: 0, yAxisIndex: 0, smooth: true, symbol: 'none', lineStyle: { color: '#f0b429', width: 2 }, areaStyle: { color: new echarts.graphic.LinearGradient(0, 0, 0, 1, [{ offset: 0, color: 'rgba(240,180,41,.3)' }, { offset: 1, color: 'rgba(240,180,41,.02)' }]) } },
          { name: '成交量', type: 'bar', data: volumes.map((v, i) => ({ value: v, itemStyle: { color: closes[i] >= opens[i] ? 'rgba(221,66,55,.4)' : 'rgba(13,157,110,.4)' } })), xAxisIndex: 1, yAxisIndex: 1 },
        ],
      }, true);
    } else {
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
    }
    state.chart.hideLoading();
    // 更新 K 线时间戳
    const timeEl = document.getElementById('klineTime');
    if (timeEl && state.klineTime) timeEl.textContent = `数据获取：${state.klineTime}`;
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

import './styles/main.css';
import { state } from './state.js';
import { isTradingTime } from './utils.js';
import { initMarket, onMarketTabOpen, rebuildChart, refreshMarket } from './market.js';
import { initCapital, loadCapitalFlow } from './capital.js';
import { initSector, loadSectorData } from './sector.js';
import { initInsight, loadInsight } from './insight.js';

// ========== 主题切换 ==========
const themeBtn = document.getElementById('themeToggle');

function setTheme(theme) {
  document.documentElement.setAttribute('data-theme', theme);
  themeBtn.textContent = theme === 'light' ? '☀️' : '🌙';
  localStorage.setItem('theme', theme);
  rebuildChart();
}

const savedTheme = localStorage.getItem('theme');
if (savedTheme) setTheme(savedTheme);
else if (window.matchMedia('(prefers-color-scheme: light)').matches) setTheme('light');

themeBtn.addEventListener('click', () => {
  const current = document.documentElement.getAttribute('data-theme');
  setTheme(current === 'light' ? 'dark' : 'light');
});

// ========== 导航切换 ==========
document.querySelectorAll('.nav-tab').forEach(tab => {
  tab.addEventListener('click', () => {
    document.querySelectorAll('.nav-tab').forEach(t => t.classList.remove('active'));
    document.querySelectorAll('.tab-panel').forEach(p => p.classList.remove('active'));
    tab.classList.add('active');
    document.getElementById('panel-' + tab.dataset.tab).classList.add('active');
    if (tab.dataset.tab === 'market') onMarketTabOpen();
  });
});

// ========== 自动刷新 ==========
setInterval(() => {
  const el = document.getElementById('statusText');
  if (isTradingTime()) {
    state.countdown--;
    if (state.countdown <= 0) {
      state.sectorData = {};
      refreshMarket();
      loadInsight();
      loadSectorData();
      loadCapitalFlow();
      state.countdown = 1800;
      document.querySelectorAll('#staleNotice, [style*="rgba(255,165,0"]').forEach(n => n.remove());
    }
    const m = Math.floor(state.countdown / 60), s = state.countdown % 60;
    el.textContent = `东方财富 · 交易中 · ${m}:${String(s).padStart(2, '0')} 后刷新`;
  } else {
    el.textContent = '东方财富 · 已休市';
    state.countdown = 1800;
  }
}, 1000);

// ========== 初始化 ==========
initMarket();
initInsight();
initCapital();
initSector();

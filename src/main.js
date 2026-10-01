import './styles/main.css';
import { state } from './state.js';
import { fetchSnapshot } from './utils.js';
import { initMarket, onMarketTabOpen, rebuildChart, refreshMarket } from './market.js';
import { initCapital, loadCapitalFlow } from './capital.js';
import { initSector, loadSectorData } from './sector.js';
import { initInsight, loadInsight } from './insight.js';

// ========== 主题切换 ==========
const themeBtn = document.getElementById('themeToggle');

const SUN_ICON = '<svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"/></svg>';
const MOON_ICON = '<svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 12.8A9 9 0 1 1 11.2 3 7 7 0 0 0 21 12.8z"/></svg>';

function setTheme(theme) {
  document.documentElement.setAttribute('data-theme', theme);
  themeBtn.innerHTML = theme === 'light' ? SUN_ICON : MOON_ICON;
  localStorage.setItem('theme', theme);
  rebuildChart();
}

const savedTheme = localStorage.getItem('theme');
setTheme(savedTheme || (window.matchMedia('(prefers-color-scheme: light)').matches ? 'light' : 'dark'));

themeBtn.addEventListener('click', () => {
  const current = document.documentElement.getAttribute('data-theme');
  setTheme(current === 'light' ? 'dark' : 'light');
});

// ========== 导航切换（滑动胶囊 + 方向感知转场） ==========
const navPill = document.querySelector('.nav-pill');

function movePill(tab, instant = false) {
  if (!navPill || !tab) return;
  if (instant) navPill.style.transition = 'none';
  navPill.style.width = tab.offsetWidth + 'px';
  navPill.style.transform = `translateX(${tab.offsetLeft}px)`;
  if (instant) requestAnimationFrame(() => requestAnimationFrame(() => { navPill.style.transition = ''; }));
}

// 初始定位 + 字体加载/窗口变化后校准
movePill(document.querySelector('.nav-tab.active'), true);
document.fonts?.ready?.then(() => movePill(document.querySelector('.nav-tab.active'), true));
window.addEventListener('resize', () => movePill(document.querySelector('.nav-tab.active'), true));

document.querySelectorAll('.nav-tab').forEach(tab => {
  tab.addEventListener('click', () => {
    if (tab.classList.contains('active')) return;
    const tabs = [...document.querySelectorAll('.nav-tab')];
    const dir = tabs.indexOf(tab) > tabs.indexOf(tabs.find(t => t.classList.contains('active'))) ? 1 : -1;
    const current = document.querySelector('.tab-panel.active');
    const next = document.getElementById('panel-' + tab.dataset.tab);
    tabs.forEach(t => t.classList.remove('active'));
    tab.classList.add('active');
    movePill(tab);
    if (!current || current === next) { next.classList.add('active'); return; }
    // 旧面板：快速淡出让位（纯 opacity/transform，不掉帧）
    current.style.setProperty('--dir', dir);
    current.classList.add('leaving');
    setTimeout(() => { current.classList.remove('active', 'leaving'); current.style.removeProperty('--dir'); }, 180);
    // 新面板：从切来的方向滑入
    next.style.setProperty('--dir', dir);
    next.classList.remove('active');
    void next.offsetWidth; // 强制 reflow，保证入场动画重启
    next.classList.add('active');
    if (tab.dataset.tab === 'market') onMarketTabOpen();
  });
});

// ========== 点击波纹 ==========
document.addEventListener('click', e => {
  const target = e.target.closest('.nav-tab, .chart-btn, .index-card, .retry-btn');
  if (!target) return;
  const r = target.getBoundingClientRect();
  const size = Math.max(r.width, r.height) * 2;
  const ripple = document.createElement('span');
  ripple.className = 'ripple';
  ripple.style.cssText = `width:${size}px;height:${size}px;left:${e.clientX - r.left - size / 2}px;top:${e.clientY - r.top - size / 2}px`;
  target.appendChild(ripple);
  ripple.addEventListener('animationend', () => ripple.remove());
});

// ========== 卡片：鼠标跟随光斑 + 3D 倾斜 ==========
let tiltEl = null;
document.addEventListener('pointermove', e => {
  const card = e.target.closest('.index-card, .insight-card');
  if (card) {
    const r = card.getBoundingClientRect();
    card.style.setProperty('--mx', (e.clientX - r.left) + 'px');
    card.style.setProperty('--my', (e.clientY - r.top) + 'px');
    if (tiltEl !== card) { if (tiltEl) tiltEl.classList.remove('tilting'); tiltEl = card; card.classList.add('tilting'); }
    card.style.setProperty('--rx', (((e.clientY - r.top) / r.height - .5) * -5).toFixed(2) + 'deg');
    card.style.setProperty('--ry', (((e.clientX - r.left) / r.width - .5) * 5).toFixed(2) + 'deg');
  } else if (tiltEl) { tiltEl.classList.remove('tilting'); tiltEl = null; }
}, { passive: true });

// ========== 快照状态与静态文件刷新（不请求上游行情） ==========
let refreshing = false;
let lastRefreshAt = Date.now();
async function loadCollectionStatus() {
  const el = document.getElementById('statusText');
  const schedule = '非实时快照 · 计划北京时间09:00 / 15:00采集（休市跳过）';
  try {
    const status = await fetchSnapshot('status');
    if (!status.groups || !['ok', 'partial', 'failed'].includes(status.state)) throw new Error('采集状态异常');
    const entries = Object.values(status.groups);
    const dates = [...new Set(entries.map(item => item.dataDate || '旧版日期未知'))].sort();
    const failed = entries.filter(item => item.state === 'failed').length;
    const pending = entries.some(item => item.freshness !== 'verified');
    el.textContent = schedule + ' · 数据日 ' + dates.join(' / ') +
      (failed ? ' · 上轮' + failed + '组失败，保留旧数据' : pending ? ' · 收盘值待次日补采' : ' · 次日补采完成');
  } catch {
    el.textContent = schedule + ' · 采集状态暂不可用，请以各面板数据日期为准';
  }
}
async function refreshSnapshots() {
  if (refreshing || document.hidden) return;
  refreshing = true;
  lastRefreshAt = Date.now();
  try {
    state.sectorData = {};
    await Promise.allSettled([refreshMarket(), loadInsight(), loadSectorData(), loadCapitalFlow(), loadCollectionStatus()]);
  } finally { refreshing = false; }
}
setInterval(() => {
  if (Date.now() - lastRefreshAt >= 30 * 60000) refreshSnapshots();
}, 60000);
document.addEventListener('visibilitychange', () => {
  if (!document.hidden && Date.now() - lastRefreshAt >= 30 * 60000) refreshSnapshots();
});
loadCollectionStatus();

// ========== 开场动画：标题逐字浮起 ==========
(function splitTitle() {
  const h1 = document.querySelector('.header h1');
  if (!h1) return;
  let i = 0;
  (function walk(node) {
    [...node.childNodes].forEach(child => {
      if (child.nodeType === 3) {
        const frag = document.createDocumentFragment();
        [...child.textContent].forEach(ch => {
          const s = document.createElement('span');
          s.className = 'ch';
          s.textContent = ch;
          s.style.animationDelay = (i++ * 0.035) + 's';
          frag.appendChild(s);
        });
        child.replaceWith(frag);
      } else walk(child);
    });
  })(h1);
})();

// ========== 揭幕层清理 ==========
const curtain = document.getElementById('curtain');
if (curtain) setTimeout(() => curtain.remove(), 1300);

// ========== 初始化 ==========
initMarket();
initInsight();
initCapital();
initSector();

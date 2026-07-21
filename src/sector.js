import { state } from './state.js';
import { DATA_PATH, saveCache, loadCache, formatMarketCap } from './utils.js';

function bindEvents() {
  document.querySelectorAll('.sector-type-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.sector-type-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      state.currentSectorType = btn.dataset.stype;
      state.sortColumn = 'rank'; state.sortDir = 'asc'; state.searchQuery = '';
      document.getElementById('searchInput').value = '';
      if (state.sectorData[state.currentSectorType]) renderSector(); else loadSectorData();
    });
  });

  document.querySelectorAll('#panel-sector thead th[data-sort]').forEach(th => {
    th.addEventListener('click', () => {
      const col = th.dataset.sort;
      if (state.sortColumn === col) state.sortDir = state.sortDir === 'asc' ? 'desc' : 'asc';
      else { state.sortColumn = col; state.sortDir = col === 'name' ? 'asc' : 'desc'; }
      renderSector();
    });
  });

  let searchDebounce = null;
  document.getElementById('searchInput').addEventListener('input', e => {
    clearTimeout(searchDebounce);
    searchDebounce = setTimeout(() => { state.searchQuery = e.target.value.trim().toLowerCase(); renderSector(); }, 300);
  });
}

async function loadSectorData() {
  const tbody = document.getElementById('sectorBody');
  tbody.innerHTML = '<tr><td colspan="8" class="loading">加载中...</td></tr>';
  try {
    const res = await fetch(`${DATA_PATH}/${state.currentSectorType}.json?t=${Date.now()}`);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();
    state.sectorData[state.currentSectorType] = data;
    saveCache('sector-' + state.currentSectorType, data);
    renderSector();
  } catch (e) {
    const cached = loadCache('sector-' + state.currentSectorType);
    if (cached) {
      state.sectorData[state.currentSectorType] = cached.data;
      renderSector();
      document.getElementById('sectorOverview').insertAdjacentHTML('afterend',
        `<div id="staleNotice" style="text-align:center;padding:6px;font-size:.75rem;color:var(--t2);background:rgba(255,165,0,.1);border-radius:8px;margin-bottom:8px">⚠️ 数据加载失败，显示缓存数据（${new Date(cached.ts).toLocaleTimeString('zh-CN')}）</div>`);
    } else {
      tbody.innerHTML = `<tr><td colspan="8" class="error"><div>加载失败：${e.message}</div><button class="retry-btn" id="retrySector">重试</button></td></tr>`;
      document.getElementById('retrySector')?.addEventListener('click', loadSectorData);
    }
  }
}

function renderSector() {
  const data = state.sectorData[state.currentSectorType];
  if (!data) return;
  let filtered = data;
  if (state.searchQuery) {
    filtered = data.filter(d => (d.name || '').toLowerCase().includes(state.searchQuery) || (d.code || '').toLowerCase().includes(state.searchQuery));
  }
  const fieldMap = { rank: null, name: 'name', changePercent: 'changePercent', changeAmount: 'changeAmount', marketCap: 'marketCap', upCount: 'upCount', downCount: 'downCount' };
  const sorted = [...filtered].sort((a, b) => {
    let va, vb;
    if (state.sortColumn === 'rank') { va = data.indexOf(a); vb = data.indexOf(b); }
    else if (state.sortColumn === 'name') { va = a.name || ''; vb = b.name || ''; }
    else { const f = fieldMap[state.sortColumn]; va = a[f] ?? 0; vb = b[f] ?? 0; }
    if (typeof va === 'string') return state.sortDir === 'asc' ? va.localeCompare(vb, 'zh') : vb.localeCompare(va, 'zh');
    return state.sortDir === 'asc' ? va - vb : vb - va;
  });
  renderSectorOverview(filtered);
  updateSortIcons();
  renderSectorTable(sorted);
}

function renderSectorTable(data) {
  const tbody = document.getElementById('sectorBody');
  if (!data.length) { tbody.innerHTML = '<tr><td colspan="8" class="no-data">无匹配结果</td></tr>'; return; }
  tbody.innerHTML = data.map((item, idx) => {
    const cp = item.changePercent ?? 0;
    const cls = cp > 0 ? 'up' : cp < 0 ? 'down' : 'flat';
    const bg = cp > 0 ? 'up-bg' : cp < 0 ? 'down-bg' : '';
    const sign = cp > 0 ? '+' : '';
    const lcCls = item.leadingChange > 0 ? 'up' : item.leadingChange < 0 ? 'down' : 'flat';
    const lcSign = item.leadingChange > 0 ? '+' : '';
    return `<tr class="${bg}">
      <td style="opacity:.5;font-size:.75rem;text-align:center">${idx + 1}</td>
      <td><strong>${item.name}</strong><br><span class="sector-code">${item.code}</span></td>
      <td class="${cls}" style="font-weight:700">${sign}${cp.toFixed(2)}%</td>
      <td class="${cls}">${sign}${(item.changeAmount ?? 0).toFixed(2)}</td>
      <td class="up">${item.upCount ?? 0}</td>
      <td class="down">${item.downCount ?? 0}</td>
      <td class="hide-mobile">${item.marketCap ? formatMarketCap(item.marketCap) : '-'}</td>
      <td class="hide-mobile">
        <div style="font-weight:500">${item.leadingStock || '-'}</div>
        ${item.leadingChange ? `<div style="font-size:.75rem" class="${lcCls}">${lcSign}${item.leadingChange.toFixed(2)}%</div>` : ''}
      </td>
    </tr>`;
  }).join('');
}

function renderSectorOverview(data) {
  let up = 0, down = 0, flat = 0, sum = 0;
  data.forEach(d => { const p = d.changePercent ?? 0; sum += p; if (p > 0) up++; else if (p < 0) down++; else flat++; });
  const avg = data.length ? sum / data.length : 0;
  const s = [...data].sort((a, b) => (b.changePercent ?? 0) - (a.changePercent ?? 0));
  const avgCls = avg > 0 ? 'up' : avg < 0 ? 'down' : 'flat';
  document.getElementById('sectorOverview').innerHTML = `
    <div class="ov-item"><span class="label">板块总数</span><span class="val">${data.length}</span></div>
    <div class="ov-item"><span class="label">上涨</span><span class="val up">${up}</span></div>
    <div class="ov-item"><span class="label">下跌</span><span class="val down">${down}</span></div>
    <div class="ov-item"><span class="label">平盘</span><span class="val flat">${flat}</span></div>
    <div class="ov-item"><span class="label">平均涨幅</span><span class="val ${avgCls}">${avg >= 0 ? '+' : ''}${avg.toFixed(2)}%</span></div>
    <div class="ov-item hide-mobile"><span class="label">最强</span><span class="val up">${s[0]?.name || '-'}</span></div>
    <div class="ov-item hide-mobile"><span class="label">最弱</span><span class="val down">${s[s.length - 1]?.name || '-'}</span></div>
  `;
}

function updateSortIcons() {
  document.querySelectorAll('#panel-sector thead th').forEach(th => {
    const si = th.querySelector('.si');
    if (!si) return;
    if (th.dataset.sort === state.sortColumn) { th.classList.add('sorted'); si.textContent = state.sortDir === 'asc' ? '▲' : '▼'; }
    else { th.classList.remove('sorted'); si.textContent = ''; }
  });
}

export function initSector() {
  bindEvents();
  loadSectorData();
}

export { loadSectorData };

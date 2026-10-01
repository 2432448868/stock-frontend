import { state } from './state.js';
import { fetchSnapshot, describeData, escapeHtml, saveCache, loadCache, formatMarketCap, skeletonRows } from './utils.js';

let sectorRequest = 0;

function bindEvents() {
  document.querySelectorAll('.sector-type-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.sector-type-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      state.currentSectorType = btn.dataset.stype;
      state.sortColumn = 'rank'; state.sortDir = 'asc'; state.searchQuery = '';
      document.getElementById('searchInput').value = '';
      loadSectorData();
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
  const request = ++sectorRequest;
  const type = state.currentSectorType;
  const tbody = document.getElementById('sectorBody');
  document.getElementById('staleNotice')?.remove();
  tbody.innerHTML = skeletonRows(8);
  try {
    const data = await fetchSnapshot(type);
    if (request !== sectorRequest) return;
    const list = data.data || data;
    if (!Array.isArray(list) || !list.length) throw new Error('板块数据为空或格式异常');
    state.sectorData[type] = list;
    state.sectorTime = describeData(data);
    saveCache('sector-' + type, data);
    renderSector();
  } catch (error) {
    if (request !== sectorRequest) return;
    const cached = loadCache('sector-' + type);
    if (cached) {
      state.sectorData[type] = cached.data;
      state.sectorTime = describeData(cached) + ' · 离线缓存';
      renderSector();
      const notice = document.createElement('p');
      notice.id = 'staleNotice';
      notice.className = 'data-time';
      notice.textContent = '网络加载失败，当前为缓存快照；缓存保存于 ' + new Date(cached.ts).toLocaleString('zh-CN');
      document.getElementById('sectorOverview').after(notice);
    } else {
      state.sectorData[type] = [];
      document.getElementById('sectorOverview').textContent = '当前分类暂无可用快照';
      tbody.innerHTML = '<tr><td colspan="8" class="error">加载失败：' + escapeHtml(error.message) + '<button class="retry-btn" id="retrySector">重试</button></td></tr>';
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
    ${state.sectorTime ? `<div class="ov-item" style="grid-column:1/-1"><span class="label" style="font-size:.7rem;opacity:.5">数据获取时间</span><span class="val" style="font-size:.75rem;opacity:.6">${escapeHtml(state.sectorTime)}</span></div>` : ''}
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

import { state } from './state.js';
import { DATA_PATH, saveCache, loadCache, formatAmount } from './utils.js';

function bindEvents() {
  document.querySelectorAll('.capital-type-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.capital-type-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      state.currentCapitalType = btn.dataset.ctype;
      loadCapitalFlow();
    });
  });
}

async function loadCapitalFlow() {
  const tbody = document.getElementById('capitalBody');
  tbody.innerHTML = '<tr><td colspan="9" class="loading">加载中...</td></tr>';
  try {
    const res = await fetch(`${DATA_PATH}/capital-${state.currentCapitalType}.json?t=${Date.now()}`);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();
    saveCache('capital-' + state.currentCapitalType, data);
    renderCapitalOverview(data);
    renderCapitalTable(data);
  } catch (e) {
    const cached = loadCache('capital-' + state.currentCapitalType);
    if (cached) {
      renderCapitalOverview(cached.data);
      renderCapitalTable(cached.data);
      document.getElementById('capitalOverview').insertAdjacentHTML('afterend',
        `<div style="text-align:center;padding:6px;font-size:.75rem;color:var(--t2);background:rgba(255,165,0,.1);border-radius:8px;margin-bottom:12px">⚠️ 数据加载失败，显示缓存数据（${new Date(cached.ts).toLocaleTimeString('zh-CN')}）</div>`);
    } else {
      tbody.innerHTML = `<tr><td colspan="9" class="error"><div>加载失败：${e.message}</div><button class="retry-btn" id="retryCapital">重试</button></td></tr>`;
      document.getElementById('retryCapital')?.addEventListener('click', loadCapitalFlow);
    }
  }
}

function renderCapitalOverview(data) {
  let totalIn = 0, totalOut = 0, upCount = 0, downCount = 0;
  data.forEach(d => {
    const flow = d.mainNetFlow ?? 0;
    if (flow > 0) totalIn += flow; else totalOut += Math.abs(flow);
    if ((d.changePercent ?? 0) > 0) upCount++; else if ((d.changePercent ?? 0) < 0) downCount++;
  });
  const net = totalIn - totalOut;
  const cls = net > 0 ? 'up' : net < 0 ? 'down' : 'flat';
  document.getElementById('capitalOverview').innerHTML = `
    <div class="ov-item"><span class="label">主力净流入</span><span class="val ${cls}">${formatAmount(net)}</span></div>
    <div class="ov-item"><span class="label">流入总额</span><span class="val up">${formatAmount(totalIn)}</span></div>
    <div class="ov-item"><span class="label">流出总额</span><span class="val down">${formatAmount(totalOut)}</span></div>
    <div class="ov-item"><span class="label">上涨板块</span><span class="val up">${upCount}</span></div>
    <div class="ov-item"><span class="label">下跌板块</span><span class="val down">${downCount}</span></div>
  `;
}

function renderCapitalTable(data) {
  const maxFlow = Math.max(...data.map(d => Math.abs(d.mainNetFlow ?? 0)));
  document.getElementById('capitalBody').innerHTML = data.map((d, i) => {
    const flow = d.mainNetFlow ?? 0;
    const cls = flow > 0 ? 'up' : flow < 0 ? 'down' : 'flat';
    const barWidth = Math.max(2, (Math.abs(flow) / maxFlow) * 80);
    const cp = d.changePercent ?? 0;
    const cpCls = cp > 0 ? 'up' : cp < 0 ? 'down' : 'flat';
    const sign = cp > 0 ? '+' : '';
    return `<tr>
      <td style="opacity:.5;font-size:.75rem;text-align:center">${i + 1}</td>
      <td><strong>${d.name}</strong><br><span class="sector-code">${d.code}</span></td>
      <td class="${cpCls}" style="font-weight:600">${sign}${cp.toFixed(2)}%</td>
      <td class="${cls}" style="font-weight:700">${formatAmount(flow)}</td>
      <td><span class="${cls}">${(d.mainPercent ?? 0) >= 0 ? '+' : ''}${(d.mainPercent ?? 0).toFixed(2)}%</span><div class="flow-bar" style="width:${barWidth}px;background:${flow > 0 ? 'var(--up)' : 'var(--down)'};opacity:.5"></div></td>
      <td class="hide-mobile ${cls}">${formatAmount(d.superNetFlow ?? 0)}</td>
      <td class="hide-mobile ${cls}">${formatAmount(d.bigNetFlow ?? 0)}</td>
      <td class="up">${d.upCount ?? 0}</td>
      <td class="down">${d.downCount ?? 0}</td>
    </tr>`;
  }).join('');
}

export function initCapital() {
  bindEvents();
  loadCapitalFlow();
}

// 供外部调用
export { loadCapitalFlow };

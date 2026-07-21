import { DATA_PATH, formatAmount } from './utils.js';

async function loadInsight() {
  try {
    const [sectorRes, capitalRes] = await Promise.all([
      fetch(`${DATA_PATH}/industry.json?t=${Date.now()}`),
      fetch(`${DATA_PATH}/capital-industry.json?t=${Date.now()}`),
    ]);
    const sectors = await sectorRes.json();
    const capital = await capitalRes.json();
    renderInsight(sectors, capital);
  } catch (e) {
    document.getElementById('insightContent').innerHTML =
      `<div class="error">洞察数据加载失败：${e.message}<br><button class="retry-btn" id="retryInsight">重试</button></div>`;
    document.getElementById('retryInsight')?.addEventListener('click', loadInsight);
  }
}

function renderInsight(sectors, capital) {
  const el = document.getElementById('insightContent');

  // 市场温度
  let up = 0, down = 0, flat = 0, sumPct = 0, extremeUp = 0, extremeDown = 0;
  sectors.forEach(s => {
    const p = s.changePercent ?? 0;
    sumPct += p;
    if (p > 0) up++; else if (p < 0) down++; else flat++;
    if (p >= 5) extremeUp++;
    if (p <= -5) extremeDown++;
  });
  const total = sectors.length;
  const ratio = down > 0 ? (up / down) : up;
  const avgPct = sumPct / total;
  const tempScore = Math.min(100, Math.max(0, Math.round(50 + ratio * 15 + avgPct * 5)));
  let tempLabel, tempColor;
  if (tempScore >= 80) { tempLabel = '🔥 过热'; tempColor = '#ff4d4f'; }
  else if (tempScore >= 60) { tempLabel = '☀️ 偏暖'; tempColor = '#ff8c00'; }
  else if (tempScore >= 40) { tempLabel = '⚖️ 中性'; tempColor = '#e6a817'; }
  else if (tempScore >= 20) { tempLabel = '🌧️ 偏冷'; tempColor = '#3b82f6'; }
  else { tempLabel = '❄️ 冰点'; tempColor = '#00b96b'; }

  // 资金动向
  let totalIn = 0, totalOut = 0;
  capital.forEach(c => { const f = c.mainNetFlow ?? 0; if (f > 0) totalIn += f; else totalOut += Math.abs(f); });
  const netFlow = totalIn - totalOut;
  const topInflow = capital.filter(c => (c.mainNetFlow ?? 0) > 0).slice(0, 5);
  const topOutflow = capital.filter(c => (c.mainNetFlow ?? 0) < 0).sort((a, b) => (a.mainNetFlow ?? 0) - (b.mainNetFlow ?? 0)).slice(0, 5);

  // 板块轮动
  const topGainers = [...sectors].sort((a, b) => (b.changePercent ?? 0) - (a.changePercent ?? 0)).slice(0, 5);
  const topLosers = [...sectors].sort((a, b) => (a.changePercent ?? 0) - (b.changePercent ?? 0)).slice(0, 5);
  const potential = capital.filter(c => (c.mainNetFlow ?? 0) > 0 && (c.changePercent ?? 0) < 1).slice(0, 3);
  const profitTaking = sectors.filter(s => (s.changePercent ?? 0) > 3).filter(s => {
    const cf = capital.find(c => c.code === s.code);
    return cf && (cf.mainNetFlow ?? 0) < 0;
  }).slice(0, 3);

  // 风险提示
  const risks = [];
  if (extremeUp >= 10) risks.push({ level: 'hot', text: `${extremeUp} 个板块涨幅超 5%，市场亢奋` });
  if (extremeDown >= 10) risks.push({ level: 'cold', text: `${extremeDown} 个板块跌幅超 5%，恐慌蔓延` });
  if (ratio > 3) risks.push({ level: 'warn', text: `涨跌比 ${ratio.toFixed(1)}:1，单边行情注意追高风险` });
  if (ratio < 0.33) risks.push({ level: 'warn', text: `涨跌比 1:${(1/ratio).toFixed(1)}，普跌格局谨慎操作` });
  if (profitTaking.length > 0) risks.push({ level: 'hot', text: `${profitTaking.length} 个强势板块资金在流出，主力可能在撤退` });
  if (total > 0 && topInflow[0]) {
    const concentration = topInflow.slice(0, 3).reduce((s, c) => s + (c.mainNetFlow ?? 0), 0) / Math.max(1, totalIn);
    if (concentration > 0.5) risks.push({ level: 'warn', text: `资金高度集中，TOP3 板块占流入 ${Math.round(concentration * 100)}%` });
  }
  if (risks.length === 0) risks.push({ level: 'cold', text: '当前市场无明显风险信号' });

  // 渲染
  el.innerHTML = `
    <div style="text-align:center;margin-bottom:16px">
      <div style="font-size:.85rem;color:var(--t2)">📋 今日市场体检报告</div>
      <div style="font-size:.72rem;color:var(--t2);margin-top:4px;opacity:.6">基于 ${total} 个行业板块 + ${capital.length} 个资金流数据 · ${new Date().toLocaleString('zh-CN')}</div>
    </div>
    <div class="insight-grid">
      <div class="insight-card">
        <div class="ic-title">🌡️ 市场温度</div>
        <div class="ic-value" style="color:${tempColor}">${tempScore}° ${tempLabel}</div>
        <div class="temp-bar"><div class="temp-fill" style="width:${tempScore}%;background:${tempColor}"></div></div>
        <div class="ic-desc">上涨 <span class="up">${up}</span> · 下跌 <span class="down">${down}</span> · 平盘 ${flat}<br>涨跌比 ${ratio.toFixed(2)}:1 · 平均涨幅 ${avgPct >= 0 ? '+' : ''}${avgPct.toFixed(2)}%</div>
      </div>
      <div class="insight-card">
        <div class="ic-title">💰 主力资金</div>
        <div class="ic-value ${netFlow > 0 ? 'up' : netFlow < 0 ? 'down' : 'flat'}">${formatAmount(netFlow)}</div>
        <div class="ic-desc">流入 <span class="up">${formatAmount(totalIn)}</span> · 流出 <span class="down">${formatAmount(totalOut)}</span><br>${netFlow > 0 ? '📈 主力净流入，市场资金面偏多' : '📉 主力净流出，市场资金面偏空'}</div>
      </div>
      <div class="insight-card">
        <div class="ic-title">🏆 强势板块 TOP5</div>
        <ul class="rank-list">${topGainers.map((s, i) => `<li><span><span class="rank-num r${Math.min(i + 1, 3)}">${i + 1}</span>${s.name}</span><span class="up" style="font-weight:700">+${s.changePercent.toFixed(2)}% <span style="font-size:.72rem;color:var(--t2)">${s.leadingStock || ''}</span></span></li>`).join('')}</ul>
      </div>
      <div class="insight-card">
        <div class="ic-title">💀 弱势板块 TOP5</div>
        <ul class="rank-list">${topLosers.map((s, i) => `<li><span><span class="rank-num" style="background:rgba(0,185,107,.${15 - i * 3});color:var(--down)">${i + 1}</span>${s.name}</span><span class="down" style="font-weight:700">${s.changePercent.toFixed(2)}% <span style="font-size:.72rem;color:var(--t2)">${s.leadingStock || ''}</span></span></li>`).join('')}</ul>
      </div>
      <div class="insight-card">
        <div class="ic-title">🧲 主力最爱 TOP5</div>
        <ul class="rank-list">${topInflow.map((c, i) => `<li><span><span class="rank-num r${Math.min(i + 1, 3)}">${i + 1}</span>${c.name}</span><span class="up" style="font-weight:600">${formatAmount(c.mainNetFlow)}</span></li>`).join('')}</ul>
      </div>
      <div class="insight-card">
        <div class="ic-title">🚪 主力最弃 TOP5</div>
        <ul class="rank-list">${topOutflow.map((c, i) => `<li><span><span class="rank-num" style="background:rgba(0,185,107,.${15 - i * 3});color:var(--down)">${i + 1}</span>${c.name}</span><span class="down" style="font-weight:600">${formatAmount(c.mainNetFlow)}</span></li>`).join('')}</ul>
      </div>
      <div class="insight-card full">
        <div class="ic-title">🔄 板块轮动信号</div>
        <div class="ic-desc" style="font-size:.83rem;line-height:1.8">
          ${potential.length > 0 ? `<div><strong>蓄势板块</strong>（资金流入但涨幅小）：<br>${potential.map(p => `<span class="risk-tag cold">${p.name} 流入${formatAmount(p.mainNetFlow)} / 涨${p.changePercent.toFixed(2)}%</span>`).join(' ')}</div>` : ''}
          ${profitTaking.length > 0 ? `<div style="margin-top:8px"><strong>获利了结</strong>（涨幅大但资金流出）：<br>${profitTaking.map(p => `<span class="risk-tag hot">${p.name} 涨+${p.changePercent.toFixed(2)}% / 资金${formatAmount(capital.find(c => c.code === p.code)?.mainNetFlow ?? 0)}</span>`).join(' ')}</div>` : ''}
          ${potential.length === 0 && profitTaking.length === 0 ? '<div>当前无明显轮动信号，资金方向与涨跌方向基本一致。</div>' : ''}
        </div>
      </div>
      <div class="insight-card full">
        <div class="ic-title">⚠️ 风险提示</div>
        <div style="display:flex;flex-wrap:wrap;gap:4px">${risks.map(r => `<span class="risk-tag ${r.level}">${r.text}</span>`).join('')}</div>
      </div>
    </div>
  `;
}

export function initInsight() {
  loadInsight();
}

export { loadInsight };

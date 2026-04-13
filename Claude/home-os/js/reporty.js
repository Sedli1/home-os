/* ═══════════════════════════════════════════════
   Home OS — modul Reporty
   ═══════════════════════════════════════════════ */

const Reporty = (() => {
  let currentYear = new Date().getFullYear();
  let _bound = false;

  const COLORS = {
    příjem:      '#10b981',
    potraviny:   '#f59e0b',
    bydlení:     '#3b82f6',
    auto:        '#6366f1',
    zdraví:      '#10b981',
    'volný čas': '#ec4899',
    děti:        '#f59e0b',
    stavba:      '#ef4444',
    pronájem:    '#8b5cf6',
    ostatní:     '#94a3b8',
  };

  async function load() {
    if (!_bound) {
      document.getElementById('reportPrevYear')?.addEventListener('click', () => {
        currentYear--;
        document.getElementById('reportYearLabel').textContent = currentYear;
        loadReport();
      });
      document.getElementById('reportNextYear')?.addEventListener('click', () => {
        currentYear++;
        document.getElementById('reportYearLabel').textContent = currentYear;
        loadReport();
      });
      _bound = true;
    }
    document.getElementById('reportYearLabel').textContent = currentYear;
    loadReport();
  }

  async function loadReport() {
    _inlineContainer = null;
    await _renderReport('report-content');
  }

  async function _oldLoadReport_UNUSED_PLACEHOLDER() {
    // This function is intentionally empty — functionality moved to _renderReport
    const from = `${currentYear}-01-01_NEVER_RUNS`;
    const to   = '';

    const [
      { data: txs },
      { data: payments },
      { data: repairs },
      { data: fuel },
    ] = await Promise.all([
      db.from('finance_transactions').select('*').gte('date', from).lte('date', to),
      db.from('rental_payments').select('*, rental_tenants(rent_amount,rental_properties(name))').gte('month', `${currentYear}-01`).lte('month', `${currentYear}-12`).eq('paid', true),
      db.from('rental_repairs').select('*').gte('date', from).lte('date', to),
      db.from('car_fuel_logs').select('*').gte('date', from).lte('date', to),
    ]);

    // Měsíční data
    const months = Array.from({ length: 12 }, (_, i) => i + 1);
    const monthIncome  = new Array(12).fill(0);
    const monthExpense = new Array(12).fill(0);

    (txs ?? []).forEach(t => {
      const m = parseInt(t.date.split('-')[1]) - 1;
      const amt = parseFloat(t.amount);
      if (t.type === 'příjem') monthIncome[m] += amt;
      else monthExpense[m] += amt;
    });

    const totalIncome  = monthIncome.reduce((s, v) => s + v, 0);
    const totalExpense = monthExpense.reduce((s, v) => s + v, 0);
    const totalBalance = totalIncome - totalExpense;

    // Kategorie
    const catTotals = {};
    (txs ?? []).filter(t => t.type === 'výdaj').forEach(t => {
      catTotals[t.category] = (catTotals[t.category] ?? 0) + parseFloat(t.amount);
    });

    // Pronájem
    const rentalIncome = (payments ?? []).reduce((s, p) => s + (parseFloat(p.amount) || parseFloat(p.rental_tenants?.rent_amount) || 0), 0);
    const repairCost   = (repairs ?? []).reduce((s, r) => s + (parseFloat(r.cost) || 0), 0);
    const fuelCost     = (fuel ?? []).reduce((s, f) => s + (parseFloat(f.price_total) || 0), 0);

    // Max pro graf
    const maxBar = Math.max(...monthIncome, ...monthExpense, 1);
    const monthNames = ['Led','Úno','Bře','Dub','Kvě','Čer','Čvc','Srp','Zář','Říj','Lis','Pro'];

    el.innerHTML = `
      <!-- KPI -->
      <div class="kpi-grid" style="margin-bottom:1.5rem">
        <div class="kpi-card">
          <div class="kpi-label">Celkové příjmy ${currentYear}</div>
          <div class="kpi-value" style="color:var(--success)">${App.formatMoney(totalIncome)}</div>
        </div>
        <div class="kpi-card">
          <div class="kpi-label">Celkové výdaje ${currentYear}</div>
          <div class="kpi-value" style="color:var(--danger)">${App.formatMoney(totalExpense)}</div>
        </div>
        <div class="kpi-card">
          <div class="kpi-label">Roční bilance</div>
          <div class="kpi-value" style="color:${totalBalance>=0?'var(--success)':'var(--danger)'}">${App.formatMoney(totalBalance)}</div>
        </div>
        <div class="kpi-card">
          <div class="kpi-label">Průměrně/měsíc</div>
          <div class="kpi-value">${App.formatMoney(totalExpense / 12)}</div>
          <div class="kpi-sub">výdaje</div>
        </div>
      </div>

      <!-- Měsíční graf -->
      <div class="card" style="margin-bottom:1.5rem">
        <div class="card-header"><div class="card-title">📊 Příjmy vs Výdaje po měsících</div></div>
        <div class="card-body">
          <div style="display:flex;align-items:flex-end;gap:4px;height:140px;padding-bottom:1.5rem;position:relative">
            ${months.map((_, i) => {
              const incPct  = (monthIncome[i]  / maxBar * 100).toFixed(1);
              const expPct  = (monthExpense[i] / maxBar * 100).toFixed(1);
              const isCurrentMonth = (new Date().getMonth() === i && new Date().getFullYear() === currentYear);
              return `<div style="flex:1;display:flex;flex-direction:column;align-items:center;gap:2px;position:relative">
                <div style="width:100%;display:flex;gap:1px;align-items:flex-end;height:120px">
                  <div style="flex:1;background:#10b981;border-radius:3px 3px 0 0;height:${incPct}%;min-height:${monthIncome[i]>0?2:0}px;transition:height .3s" title="${App.formatMoney(monthIncome[i])}"></div>
                  <div style="flex:1;background:#ef4444;border-radius:3px 3px 0 0;height:${expPct}%;min-height:${monthExpense[i]>0?2:0}px;transition:height .3s" title="${App.formatMoney(monthExpense[i])}"></div>
                </div>
                <div style="font-size:.6rem;color:${isCurrentMonth?'var(--primary)':'var(--text-muted)'};font-weight:${isCurrentMonth?700:400}">${monthNames[i]}</div>
              </div>`;
            }).join('')}
          </div>
          <div style="display:flex;gap:1rem;font-size:.8rem;color:var(--text-muted)">
            <span><span style="display:inline-block;width:10px;height:10px;background:#10b981;border-radius:2px;margin-right:.3rem"></span>Příjmy</span>
            <span><span style="display:inline-block;width:10px;height:10px;background:#ef4444;border-radius:2px;margin-right:.3rem"></span>Výdaje</span>
          </div>
        </div>
      </div>

      <div class="grid-2" style="gap:1rem;margin-bottom:1.5rem">
        <!-- Výdaje dle kategorií -->
        <div class="card">
          <div class="card-header"><div class="card-title">📂 Výdaje dle kategorií</div></div>
          <div class="card-body">
            ${Object.entries(catTotals).length ? Object.entries(catTotals).sort((a,b)=>b[1]-a[1]).map(([cat, amt]) => {
              const pct = totalExpense > 0 ? Math.round(amt / totalExpense * 100) : 0;
              const color = COLORS[cat] ?? '#94a3b8';
              return `<div style="margin-bottom:.625rem">
                <div style="display:flex;justify-content:space-between;font-size:.8125rem;margin-bottom:.25rem">
                  <span>${cat}</span>
                  <span style="font-weight:600">${App.formatMoney(amt)} <span style="font-weight:400;color:var(--text-muted)">(${pct}%)</span></span>
                </div>
                <div class="progress-bar">
                  <div class="progress-fill" style="width:${pct}%;background:${color}"></div>
                </div>
              </div>`;
            }).join('') : '<div style="color:var(--text-muted);font-size:.875rem">Žádné výdaje.</div>'}
          </div>
        </div>

        <!-- Pronájem & ostatní -->
        <div style="display:flex;flex-direction:column;gap:1rem">
          ${rentalIncome > 0 || repairCost > 0 ? `<div class="card">
            <div class="card-header"><div class="card-title">🏘️ Pronájem ${currentYear}</div></div>
            <div class="card-body">
              <div style="display:flex;justify-content:space-between;font-size:.875rem;padding:.375rem 0;border-bottom:1px solid var(--border)">
                <span>Příjmy z nájmu</span><strong style="color:var(--success)">${App.formatMoney(rentalIncome)}</strong>
              </div>
              <div style="display:flex;justify-content:space-between;font-size:.875rem;padding:.375rem 0;border-bottom:1px solid var(--border)">
                <span>Opravy a náklady</span><strong style="color:var(--danger)">${App.formatMoney(repairCost)}</strong>
              </div>
              <div style="display:flex;justify-content:space-between;font-size:.875rem;padding:.375rem 0;font-weight:700">
                <span>Čistý zisk</span><span style="color:${rentalIncome-repairCost>=0?'var(--success)':'var(--danger)'}">${App.formatMoney(rentalIncome - repairCost)}</span>
              </div>
            </div>
          </div>` : ''}
          ${fuelCost > 0 ? `<div class="card">
            <div class="card-header"><div class="card-title">⛽ Palivo ${currentYear}</div></div>
            <div class="card-body">
              <div style="font-size:.875rem">Celkové náklady na palivo: <strong style="color:var(--danger)">${App.formatMoney(fuelCost)}</strong></div>
            </div>
          </div>` : ''}
          <div class="card">
            <div class="card-header"><div class="card-title">📋 Souhrn roku ${currentYear}</div></div>
            <div class="card-body" style="font-size:.875rem">
              ${[
                ['Transakce celkem', (txs??[]).length + ' položek'],
                ['Průměrný měsíční příjem', App.formatMoney(totalIncome/12)],
                ['Průměrný měsíční výdaj', App.formatMoney(totalExpense/12)],
              ].map(([label, val]) => `<div style="display:flex;justify-content:space-between;padding:.375rem 0;border-bottom:1px solid var(--border)">
                <span style="color:var(--text-muted)">${label}</span><strong>${val}</strong>
              </div>`).join('')}
            </div>
          </div>
        </div>
      </div>
    `;
  }

  // ── Inline mode (Finance tab) ─────────────────
  let _inlineContainer = null;

  function loadInto(containerId) {
    const wrapper = document.getElementById(containerId);
    if (!wrapper) return;
    _inlineContainer = 'report-inline-body';
    wrapper.innerHTML = `
      <div style="display:flex;align-items:center;gap:.5rem;margin:1rem 0 1.25rem">
        <button class="btn btn-sm btn-outline btn-icon" onclick="Reporty._shiftYear(-1)">‹</button>
        <span style="font-weight:700;min-width:54px;text-align:center" id="reportInlineYear">${currentYear}</span>
        <button class="btn btn-sm btn-outline btn-icon" onclick="Reporty._shiftYear(1)">›</button>
      </div>
      <div id="report-inline-body"></div>`;
    _renderReport(_inlineContainer);
  }

  function _shiftYear(delta) {
    currentYear += delta;
    const el = document.getElementById('reportInlineYear') ?? document.getElementById('reportYearLabel');
    if (el) el.textContent = currentYear;
    if (_inlineContainer) _renderReport(_inlineContainer);
    else _renderReport('report-content');
  }

  async function _renderReport(targetId) {
    const el = document.getElementById(targetId);
    if (!el) return;
    el.innerHTML = '<div class="loading"><div class="spinner"></div> Načítám…</div>';

    const from = `${currentYear}-01-01`;
    const to   = `${currentYear}-12-31`;

    const [
      { data: txs },
      { data: payments },
      { data: repairs },
      { data: fuel },
    ] = await Promise.all([
      db.from('finance_transactions').select('*').gte('date', from).lte('date', to),
      db.from('rental_payments').select('*, rental_tenants(rent_amount,rental_properties(name))').gte('month', `${currentYear}-01`).lte('month', `${currentYear}-12`).eq('paid', true),
      db.from('rental_repairs').select('*').gte('date', from).lte('date', to),
      db.from('car_fuel_logs').select('*').gte('date', from).lte('date', to),
    ]);

    const months = Array.from({ length: 12 }, (_, i) => i + 1);
    const monthIncome  = new Array(12).fill(0);
    const monthExpense = new Array(12).fill(0);
    (txs ?? []).forEach(t => {
      const m = parseInt(t.date.split('-')[1]) - 1;
      const amt = parseFloat(t.amount);
      if (t.type === 'příjem') monthIncome[m] += amt;
      else monthExpense[m] += amt;
    });
    const totalIncome  = monthIncome.reduce((s, v) => s + v, 0);
    const totalExpense = monthExpense.reduce((s, v) => s + v, 0);
    const totalBalance = totalIncome - totalExpense;

    const catTotals = {}, memberTotals = {};
    (txs ?? []).filter(t => t.type === 'výdaj').forEach(t => {
      catTotals[t.category] = (catTotals[t.category] ?? 0) + parseFloat(t.amount);
      if (t.member) memberTotals[t.member] = (memberTotals[t.member] ?? 0) + parseFloat(t.amount);
    });
    const rentalIncome = (payments ?? []).reduce((s, p) => s + (parseFloat(p.rental_tenants?.rent_amount) || 0), 0);
    const repairCost   = (repairs ?? []).reduce((s, r) => s + (parseFloat(r.cost) || 0), 0);
    const fuelCost     = (fuel ?? []).reduce((s, f) => s + (parseFloat(f.price_total) || 0), 0);

    // Cumulative balance per month
    const cumBalance = [];
    let running = 0;
    for (let i = 0; i < 12; i++) {
      running += monthIncome[i] - monthExpense[i];
      cumBalance.push(running);
    }

    const maxBar = Math.max(...monthIncome, ...monthExpense, 1);
    const MONTH_CS = ['Led','Úno','Bře','Dub','Kvě','Čer','Čvc','Srp','Zář','Říj','Lis','Pro'];

    el.innerHTML = `
      <div style="display:flex;gap:.75rem;flex-wrap:wrap;margin-bottom:1.25rem">
        <div class="kpi-card" style="flex:1;min-width:120px"><div class="kpi-label">Příjmy</div><div class="kpi-value" style="color:var(--success)">${App.formatMoney(totalIncome)}</div></div>
        <div class="kpi-card" style="flex:1;min-width:120px"><div class="kpi-label">Výdaje</div><div class="kpi-value" style="color:var(--danger)">${App.formatMoney(totalExpense)}</div></div>
        <div class="kpi-card ${totalBalance >= 0 ? '' : 'kpi-negative'}" style="flex:1;min-width:120px"><div class="kpi-label">Bilance</div><div class="kpi-value">${App.formatMoney(totalBalance)}</div></div>
        ${rentalIncome > 0 ? `<div class="kpi-card" style="flex:1;min-width:120px"><div class="kpi-label">Pronájem</div><div class="kpi-value" style="color:var(--success)">${App.formatMoney(rentalIncome)}</div></div>` : ''}
      </div>
      <div class="card" style="margin-bottom:1.25rem">
        <div class="card-header">
          <div class="card-title">Příjmy vs Výdaje</div>
          <div style="display:flex;gap:.75rem;font-size:.75rem;color:var(--text-muted)">
            <span><span style="display:inline-block;width:8px;height:8px;background:var(--success);border-radius:2px;margin-right:.3rem;opacity:.8"></span>Příjmy</span>
            <span><span style="display:inline-block;width:8px;height:8px;background:var(--danger);border-radius:2px;margin-right:.3rem;opacity:.8"></span>Výdaje</span>
          </div>
        </div>
        <div class="card-body" style="position:relative">
          <!-- Tooltip -->
          <div id="chart-tooltip" style="display:none;position:absolute;background:rgba(15,23,42,.88);color:#fff;font-size:.75rem;padding:.35rem .6rem;border-radius:6px;pointer-events:none;z-index:10;white-space:nowrap;line-height:1.6"></div>
          <!-- Y-axis + bars -->
          <div style="display:flex;gap:0">
            <!-- Y axis labels -->
            <div style="display:flex;flex-direction:column;justify-content:space-between;align-items:flex-end;height:120px;padding-bottom:1.25rem;margin-right:.375rem;flex-shrink:0">
              ${[1,.75,.5,.25,0].map(f => `<span style="font-size:.58rem;color:var(--text-muted);line-height:1">${f>0?App.formatMoney(Math.round(maxBar*f/1000)*1000):''}</span>`).join('')}
            </div>
            <!-- Bar columns -->
            <div style="flex:1;display:flex;gap:3px;align-items:flex-end;height:120px;position:relative">
              <!-- Grid lines -->
              <div style="position:absolute;inset:0;bottom:1.25rem;pointer-events:none">
                ${[.75,.5,.25].map(f=>`<div style="position:absolute;left:0;right:0;top:${Math.round((1-f)*100)}%;border-top:1px dashed var(--border);opacity:.6"></div>`).join('')}
              </div>
              ${months.map(m => {
                const inc = monthIncome[m-1];
                const exp = monthExpense[m-1];
                const hasData = inc > 0 || exp > 0;
                return `<div style="flex:1;display:flex;flex-direction:column;gap:0;align-items:center;cursor:${hasData?'pointer':'default'};border-radius:4px;padding:1px"
                  ${hasData ? `onclick="Finance.showMonthDetail(${currentYear},${m})"` : ''}
                  onmouseover="if(${hasData}){this.style.background='var(--surface3)';var t=document.getElementById('chart-tooltip');t.style.display='block';t.innerHTML='<strong>${MONTH_CS[m-1]}</strong><br>↑ ${App.formatMoney(inc)}<br>↓ ${App.formatMoney(exp)}'}"
                  onmousemove="var t=document.getElementById('chart-tooltip');var r=this.closest('.card-body').getBoundingClientRect();t.style.left=(event.clientX-r.left+8)+'px';t.style.top=(event.clientY-r.top-10)+'px'"
                  onmouseout="this.style.background='';document.getElementById('chart-tooltip').style.display='none'">
                  <div style="width:100%;display:flex;gap:1px;align-items:flex-end;height:100px">
                    <div style="flex:1;background:var(--success);opacity:.75;height:${Math.round(inc/maxBar*100)}%;border-radius:2px 2px 0 0;min-height:${inc>0?2:0}px;transition:opacity .15s" onmouseover="this.style.opacity=1" onmouseout="this.style.opacity=.75"></div>
                    <div style="flex:1;background:var(--danger);opacity:.75;height:${Math.round(exp/maxBar*100)}%;border-radius:2px 2px 0 0;min-height:${exp>0?2:0}px;transition:opacity .15s" onmouseover="this.style.opacity=1" onmouseout="this.style.opacity=.75"></div>
                  </div>
                  <div style="font-size:.58rem;color:${hasData?'var(--primary)':'var(--text-muted)'};font-weight:${hasData?600:400};padding-top:.25rem">${MONTH_CS[m-1]}</div>
                </div>`;
              }).join('')}
            </div>
          </div>
        </div>
      </div>
      ${Object.keys(catTotals).length ? (() => {
        const sorted = Object.entries(catTotals).sort((a,b)=>b[1]-a[1]).slice(0,8);
        // Build SVG donut
        const cx=80,cy=80,R=68,ri=42; let angle=-Math.PI/2;
        const arcs = sorted.map(([cat,amt]) => {
          const color = COLORS[cat]??'#94a3b8';
          const span = (amt/totalExpense)*2*Math.PI;
          const x1=cx+R*Math.cos(angle),y1=cy+R*Math.sin(angle);
          const x2=cx+R*Math.cos(angle+span),y2=cy+R*Math.sin(angle+span);
          const xi1=cx+ri*Math.cos(angle),yi1=cy+ri*Math.sin(angle);
          const xi2=cx+ri*Math.cos(angle+span),yi2=cy+ri*Math.sin(angle+span);
          const lg=span>Math.PI?1:0;
          const d=`M${x1} ${y1} A${R} ${R} 0 ${lg} 1 ${x2} ${y2} L${xi2} ${yi2} A${ri} ${ri} 0 ${lg} 0 ${xi1} ${yi1}Z`;
          angle+=span;
          return `<path d="${d}" fill="${color}" stroke="var(--surface)" stroke-width="2"><title>${cat}: ${App.formatMoney(amt)}</title></path>`;
        }).join('');
        const donutSvg = `<svg viewBox="0 0 160 160" style="width:150px;height:150px;flex-shrink:0">${arcs}
          <text x="80" y="76" text-anchor="middle" font-size="9" fill="var(--text-muted)">Výdaje</text>
          <text x="80" y="91" text-anchor="middle" font-size="12" font-weight="700" fill="var(--text)">${Math.round(totalExpense/1000)}K Kč</text>
        </svg>`;
        const bars = sorted.map(([cat,amt]) => {
          const pct=Math.round(amt/totalExpense*100), color=COLORS[cat]??'#94a3b8';
          return `<div style="margin-bottom:.5rem">
            <div style="display:flex;justify-content:space-between;font-size:.8rem;margin-bottom:.2rem">
              <span><span style="display:inline-block;width:8px;height:8px;border-radius:2px;background:${color};margin-right:.35rem"></span>${cat??'ostatní'}</span>
              <span style="font-weight:600">${App.formatMoney(amt)} <span style="color:var(--text-muted);font-weight:400">(${pct}%)</span></span>
            </div>
            <div class="progress-bar"><div class="progress-fill" style="width:${pct}%;background:${color}"></div></div>
          </div>`;
        }).join('');
        return `<div class="card" style="margin-bottom:1.25rem">
          <div class="card-header">
            <div class="card-title">Výdaje podle kategorií</div>
            <div style="display:flex;gap:.3rem">
              <button id="cat-view-bars" class="btn btn-sm btn-outline active" onclick="document.getElementById('cat-donut').style.display='none';document.getElementById('cat-bars').style.display='';this.classList.add('active');document.getElementById('cat-view-donut').classList.remove('active')">≡ Bary</button>
              <button id="cat-view-donut" class="btn btn-sm btn-outline" onclick="document.getElementById('cat-bars').style.display='none';document.getElementById('cat-donut').style.display='flex';this.classList.add('active');document.getElementById('cat-view-bars').classList.remove('active')">◉ Donut</button>
            </div>
          </div>
          <div class="card-body">
            <div id="cat-bars">${bars}</div>
            <div id="cat-donut" style="display:none;align-items:center;gap:1.25rem;flex-wrap:wrap">
              ${donutSvg}
              <div style="flex:1;min-width:140px">${bars}</div>
            </div>
          </div>
        </div>`;
      })() : ''}
      ${(() => {
        const hasBalance = cumBalance.some(v => v !== 0);
        if (!hasBalance) return '';
        const min=Math.min(...cumBalance), max=Math.max(...cumBalance);
        const range=(max-min)||1;
        const W=360, H=70, PX=4, PY=6;
        const pts = cumBalance.map((v,i) => {
          const x = PX + (i/11)*(W-2*PX);
          const y = H - PY - ((v-min)/range)*(H-2*PY);
          return [x,y];
        });
        const polyline = pts.map(([x,y])=>`${x},${y}`).join(' ');
        // Area fill path
        const areaPath = `M${pts[0][0]},${H-PY} L${pts.map(([x,y])=>`${x},${y}`).join(' L')} L${pts[pts.length-1][0]},${H-PY}Z`;
        const dots = pts.map(([x,y],i) => {
          const v = cumBalance[i];
          const col = v>=0?'#22c55e':'#ef4444';
          return `<circle cx="${x}" cy="${y}" r="3" fill="${col}" stroke="var(--surface)" stroke-width="1.5"><title>${MONTH_CS[i]}: ${App.formatMoney(v)}</title></circle>`;
        }).join('');
        const zeroY = H - PY - ((0-min)/range)*(H-2*PY);
        const zeroLine = min < 0 && max > 0 ? `<line x1="${PX}" y1="${zeroY}" x2="${W-PX}" y2="${zeroY}" stroke="#ef4444" stroke-width="1" stroke-dasharray="3,3" opacity=".5"/>` : '';
        return `<div class="card" style="margin-bottom:1.25rem">
          <div class="card-header"><div class="card-title">📈 Vývoj bilance ${currentYear}</div></div>
          <div class="card-body" style="overflow:hidden">
            <svg viewBox="0 0 ${W} ${H+16}" style="width:100%;height:auto;display:block">
              <defs>
                <linearGradient id="balGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stop-color="${totalBalance>=0?'#22c55e':'#ef4444'}" stop-opacity=".25"/>
                  <stop offset="100%" stop-color="${totalBalance>=0?'#22c55e':'#ef4444'}" stop-opacity="0"/>
                </linearGradient>
              </defs>
              ${zeroLine}
              <path d="${areaPath}" fill="url(#balGrad)"/>
              <polyline points="${polyline}" fill="none" stroke="${totalBalance>=0?'#22c55e':'#ef4444'}" stroke-width="2" stroke-linejoin="round"/>
              ${dots}
              ${pts.map(([x,],i) => `<text x="${x}" y="${H+14}" text-anchor="middle" font-size="7" fill="var(--text-muted)">${MONTH_CS[i]}</text>`).join('')}
            </svg>
          </div>
        </div>`;
      })()}
      ${Object.keys(memberTotals).length >= 1 ? `<div class="card" style="margin-bottom:1.25rem">
        <div class="card-header"><div class="card-title">👥 Výdaje podle člena</div></div>
        <div class="card-body">
          ${Object.entries(memberTotals).sort((a,b)=>b[1]-a[1]).map(([m,amt]) => {
            const pct = totalExpense>0 ? Math.round(amt/totalExpense*100) : 0;
            const col = m==='Jakub'?'#6366f1':m==='Adriana'?'#ec4899':'#94a3b8';
            return `<div style="margin-bottom:.75rem">
              <div style="display:flex;justify-content:space-between;font-size:.875rem;margin-bottom:.3rem">
                <span style="font-weight:600">👤 ${App.esc(m)}</span>
                <span>${App.formatMoney(amt)} <span style="color:var(--text-muted);font-size:.8rem">(${pct}% výdajů)</span></span>
              </div>
              <div class="progress-bar" style="height:8px"><div class="progress-fill" style="width:${pct}%;background:${col};height:8px;border-radius:4px"></div></div>
            </div>`;
          }).join('')}
          <div style="font-size:.78rem;color:var(--text-muted);margin-top:.5rem">
            ${totalExpense - Object.values(memberTotals).reduce((s,v)=>s+v,0) > 0
              ? `Nepřiřazeno: ${App.formatMoney(totalExpense - Object.values(memberTotals).reduce((s,v)=>s+v,0))}`
              : 'Všechny výdaje jsou přiřazeny.'}
          </div>
        </div>
      </div>` : ''}
      ${(repairCost > 0 || fuelCost > 0) ? `<div style="display:flex;gap:.75rem;flex-wrap:wrap">
        ${repairCost > 0 ? `<div class="kpi-card" style="flex:1;min-width:120px"><div class="kpi-label">Opravy pronájmu</div><div class="kpi-value" style="color:var(--danger)">${App.formatMoney(repairCost)}</div></div>` : ''}
        ${fuelCost > 0 ? `<div class="kpi-card" style="flex:1;min-width:120px"><div class="kpi-label">Palivo</div><div class="kpi-value">${App.formatMoney(fuelCost)}</div></div>` : ''}
      </div>` : ''}
    `;
  }

  return { load, loadInto, _shiftYear };
})();

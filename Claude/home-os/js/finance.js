/* ═══════════════════════════════════════════════
   Home OS — modul Finance
   ═══════════════════════════════════════════════ */

const Finance = (() => {
  const CATEGORIES = {
    příjem:      { label: 'Příjem',       color: '#10b981', emoji: '💰' },
    potraviny:   { label: 'Potraviny',    color: '#f59e0b', emoji: '🛒' },
    bydlení:     { label: 'Bydlení',      color: '#3b82f6', emoji: '🏠' },
    auto:        { label: 'Auto',         color: '#6366f1', emoji: '🚗' },
    zdraví:      { label: 'Zdraví',       color: '#10b981', emoji: '❤️' },
    'volný čas': { label: 'Volný čas',    color: '#ec4899', emoji: '🎉' },
    děti:        { label: 'Děti',         color: '#f59e0b', emoji: '👶' },
    stavba:      { label: 'Stavba',       color: '#ef4444', emoji: '🏗️' },
    pronájem:    { label: 'Pronájem',     color: '#8b5cf6', emoji: '🏘️' },
    ostatní:     { label: 'Ostatní',      color: '#94a3b8', emoji: '📦' },
  };

  let currentYear  = new Date().getFullYear();
  let currentMonth = new Date().getMonth() + 1;
  let _bound       = false;
  let _activeTab   = 'jednorazove';
  let _chartMode   = 'month'; // 'month' | 'year'

  function load() {
    setMonthLabel();
    _switchTab(_activeTab, false);

    if (!_bound) {
      document.getElementById('prevMonthBtn')?.addEventListener('click', () => {
        currentMonth--;
        if (currentMonth < 1) { currentMonth = 12; currentYear--; }
        setMonthLabel();
        if (_activeTab === 'jednorazove') loadTransactions();
      });
      document.getElementById('nextMonthBtn')?.addEventListener('click', () => {
        currentMonth++;
        if (currentMonth > 12) { currentMonth = 1; currentYear++; }
        setMonthLabel();
        if (_activeTab === 'jednorazove') loadTransactions();
      });
      document.getElementById('addTxBtn')?.addEventListener('click', openAddTx);
      document.getElementById('addRecurringBtn')?.addEventListener('click', openAddRecurring);
      document.getElementById('importTxBtn')?.addEventListener('click', openImport);

      document.querySelectorAll('#page-finance .tab-btn[data-ftab]').forEach(btn => {
        btn.addEventListener('click', () => _switchTab(btn.dataset.ftab));
      });
      _bound = true;
    }
  }

  function _switchTab(tab, save = true) {
    if (save) _activeTab = tab;
    document.querySelectorAll('#page-finance .tab-btn[data-ftab]').forEach(b => {
      b.classList.toggle('active', b.dataset.ftab === tab);
    });
    document.querySelectorAll('#page-finance .fin-panel').forEach(p => p.style.display = 'none');
    document.getElementById(`fin-panel-${tab}`)?.style.setProperty('display', '');

    // Show/hide month nav (only relevant for single-month views)
    const monthNav = document.querySelector('#page-finance .month-nav');
    if (monthNav) monthNav.style.display = tab === 'jednorazove' ? '' : 'none';

    if (tab === 'jednorazove') loadTransactions();
    else if (tab === 'opakujici') loadRecurring();
    else if (tab === 'rocni') Reporty.loadInto('fin-tab-reporty');
  }

  function setChartMode(mode) {
    _chartMode = mode;
    document.getElementById('chartToggleMonth')?.classList.toggle('active', mode === 'month');
    document.getElementById('chartToggleYear')?.classList.toggle('active', mode === 'year');
    if (mode === 'month') {
      // re-run loadTransactions to rebuild chart from monthly data
      loadTransactions();
    } else {
      loadYearChart();
    }
  }

  async function loadYearChart() {
    const { data } = await db
      .from('finance_transactions')
      .select('amount,type,category')
      .gte('date', `${currentYear}-01-01`)
      .lte('date', `${currentYear}-12-31`);
    const catTotals = {};
    let expense = 0;
    (data ?? []).forEach(t => {
      if (t.type !== 'příjem') {
        const amt = parseFloat(t.amount);
        expense += amt;
        catTotals[t.category] = (catTotals[t.category] ?? 0) + amt;
      }
    });
    renderCategoryChart(catTotals, expense);
  }

  function setMonthLabel() {
    const d = new Date(currentYear, currentMonth - 1, 1);
    document.getElementById('monthLabel').textContent = d.toLocaleDateString('cs-CZ', { month: 'long', year: 'numeric' });
  }

  function openMonthPicker(anchor) {
    // Remove any existing picker
    document.getElementById('month-picker-popup')?.remove();
    const MONTHS = ['Led','Úno','Bře','Dub','Kvě','Čer','Čvc','Srp','Zář','Říj','Lis','Pro'];
    let pickerYear = currentYear;
    const popup = document.createElement('div');
    popup.id = 'month-picker-popup';
    popup.style.cssText = `position:fixed;z-index:9999;background:var(--surface);border:1px solid var(--border);border-radius:12px;box-shadow:0 8px 32px rgba(0,0,0,.18);padding:.75rem;min-width:240px`;
    const rect = anchor.getBoundingClientRect();
    popup.style.top  = (rect.bottom + 6) + 'px';
    popup.style.left = Math.max(8, rect.left - 40) + 'px';

    function render() {
      popup.innerHTML = `
        <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:.625rem">
          <button onclick="this.closest('#month-picker-popup')._y--;this.closest('#month-picker-popup')._render()" style="background:none;border:none;cursor:pointer;font-size:1.1rem;padding:.1rem .4rem;border-radius:4px;color:var(--text)">‹</button>
          <span style="font-weight:700;font-size:.95rem">${pickerYear}</span>
          <button onclick="this.closest('#month-picker-popup')._y++;this.closest('#month-picker-popup')._render()" style="background:none;border:none;cursor:pointer;font-size:1.1rem;padding:.1rem .4rem;border-radius:4px;color:var(--text)">›</button>
        </div>
        <div style="display:grid;grid-template-columns:repeat(4,1fr);gap:.3rem">
          ${MONTHS.map((m, i) => {
            const isActive = (pickerYear === currentYear && i + 1 === currentMonth);
            return `<button onclick="Finance._pickMonth(${pickerYear},${i+1})"
              style="padding:.35rem .2rem;border-radius:6px;border:1px solid ${isActive ? 'var(--primary)' : 'transparent'};
                background:${isActive ? 'var(--primary)' : 'transparent'};color:${isActive ? '#fff' : 'var(--text)'};
                cursor:pointer;font-size:.8rem;font-weight:${isActive ? 700 : 400};transition:background .1s"
              onmouseover="if(!${isActive})this.style.background='var(--surface3)'" onmouseout="if(!${isActive})this.style.background='transparent'">${m}</button>`;
          }).join('')}
        </div>`;
      popup._y = pickerYear;
      popup._render = () => { pickerYear = popup._y; render(); };
    }
    render();
    document.body.appendChild(popup);
    // Close on outside click
    setTimeout(() => {
      const close = (e) => { if (!popup.contains(e.target) && e.target !== anchor) { popup.remove(); document.removeEventListener('click', close); } };
      document.addEventListener('click', close);
    }, 10);
  }

  function _pickMonth(year, month) {
    currentYear  = year;
    currentMonth = month;
    setMonthLabel();
    document.getElementById('month-picker-popup')?.remove();
    loadTransactions();
  }

  // ── Transaction filtering ─────────────────────
  let _txData = [];

  function _populateCatFilter() {
    const sel = document.getElementById('tx-filter-cat');
    if (!sel || sel.options.length > 1) return; // already populated
    Object.entries(CATEGORIES).forEach(([k, v]) => {
      const o = document.createElement('option');
      o.value = k; o.textContent = `${v.emoji} ${v.label}`;
      sel.appendChild(o);
    });
  }

  function filterTx() {
    const q      = (document.getElementById('tx-search')?.value ?? '').toLowerCase();
    const cat    = document.getElementById('tx-filter-cat')?.value ?? '';
    const member = document.getElementById('tx-filter-member')?.value ?? '';
    const type   = document.getElementById('tx-filter-type')?.value ?? '';
    const sort   = document.getElementById('tx-sort')?.value ?? 'date-desc';

    const filtered = _txData.filter(t => {
      if (type   && t.type !== type) return false;
      if (cat    && t.category !== cat) return false;
      if (member && t.member !== member) return false;
      if (q && !( (t.description||'').toLowerCase().includes(q) || (t.category||'').toLowerCase().includes(q) || (t.member||'').toLowerCase().includes(q) )) return false;
      return true;
    });

    filtered.sort((a, b) => {
      // Primary sort
      let primary = 0;
      switch (sort) {
        case 'date-asc':    primary = a.date.localeCompare(b.date); break;
        case 'date-desc':   primary = b.date.localeCompare(a.date); break;
        case 'amount-desc': primary = Math.abs(parseFloat(b.amount)) - Math.abs(parseFloat(a.amount)); break;
        case 'amount-asc':  primary = Math.abs(parseFloat(a.amount)) - Math.abs(parseFloat(b.amount)); break;
        case 'member-asc':  primary = (a.member||'ž').localeCompare(b.member||'ž'); break; // prázdné na konec
      }
      if (primary !== 0) return primary;
      // Sekundárně vždy datum ↓
      return b.date.localeCompare(a.date);
    });

    _renderTxList(filtered);
  }

  function _renderTxList(data) {
    const el = document.getElementById('tx-list');
    if (!el) return;
    if (!data.length) {
      el.innerHTML = `<div class="empty-state" style="padding:1.5rem 0"><div class="empty-icon">🔍</div><div class="empty-title">Žádné výsledky</div></div>`;
      return;
    }
    el.innerHTML = data.map(t => {
      const cat = CATEGORIES[t.category] ?? CATEGORIES.ostatní;
      const isIncome = t.type === 'příjem';
      return `<div class="tx-item">
        <div class="tx-category-dot" style="background:${cat.color}"></div>
        <div style="font-size:1.1rem">${cat.emoji}</div>
        <div class="tx-body">
          <div class="tx-desc">${App.esc(t.description || cat.label)}</div>
          <div class="tx-meta">${App.formatDate(t.date)} · ${cat.label}${t.member ? ' · 👤 ' + App.esc(t.member) : ''}</div>
        </div>
        <div class="tx-amount ${isIncome ? 'income' : 'expense'}">
          ${isIncome ? '+' : '−'}${App.formatMoney(Math.abs(t.amount))}
        </div>
        <div class="tx-actions">
          <button class="btn btn-icon btn-ghost btn-sm" onclick="Finance.editTx('${t.id}')">✏️</button>
          <button class="btn btn-icon btn-ghost btn-sm" onclick="Finance.deleteTx('${t.id}')">🗑️</button>
        </div>
      </div>`;
    }).join('');
  }

  async function loadTransactions() {
    const el = document.getElementById('tx-list');
    el.innerHTML = '<div class="loading"><div class="spinner"></div> Načítám…</div>';

    const pad  = n => String(n).padStart(2, '0');
    const from = `${currentYear}-${pad(currentMonth)}-01`;
    const lastDay = new Date(currentYear, currentMonth, 0).getDate(); // last day of currentMonth
    const to   = `${currentYear}-${pad(currentMonth)}-${pad(lastDay)}`;

    const { data, error } = await db
      .from('finance_transactions')
      .select('*')
      .gte('date', from)
      .lte('date', to)
      .order('date', { ascending: false });

    if (error) { el.innerHTML = `<div class="empty-state"><div class="empty-text">Chyba: ${App.esc(error.message)}</div></div>`; return; }

    _txData = data ?? [];
    _populateCatFilter();

    let income = 0, expense = 0;
    const catTotals = {};
    _txData.forEach(t => {
      const amt = parseFloat(t.amount);
      if (t.type === 'příjem') income += amt;
      else expense += amt;
      catTotals[t.category] = (catTotals[t.category] ?? 0) + (t.type === 'výdaj' ? amt : 0);
    });

    document.getElementById('finance-income').textContent  = App.formatMoney(income);
    document.getElementById('finance-expense').textContent = App.formatMoney(expense);
    const bal = income - expense;
    const balEl = document.getElementById('finance-balance');
    balEl.textContent = App.formatMoney(bal);
    balEl.style.color = bal >= 0 ? 'var(--success)' : 'var(--danger)';

    // Month-over-month delta (async, non-blocking)
    (() => {
      const prevY = currentMonth === 1 ? currentYear - 1 : currentYear;
      const prevM = currentMonth === 1 ? 12 : currentMonth - 1;
      const pFrom = `${prevY}-${pad(prevM)}-01`;
      const pLast = new Date(prevY, prevM, 0).getDate();
      const pTo   = `${prevY}-${pad(prevM)}-${pad(pLast)}`;
      db.from('finance_transactions').select('amount,type').gte('date', pFrom).lte('date', pTo)
        .then(({ data: pd }) => {
          const prevBal = (pd ?? []).reduce((s,t) => s + (t.type==='příjem' ? parseFloat(t.amount) : -parseFloat(t.amount)), 0);
          const delta = bal - prevBal;
          const MONTH_CS_SHORT = ['led','úno','bře','dub','kvě','čer','čvc','srp','zář','říj','lis','pro'];
          const deltaEl = document.getElementById('finance-balance');
          if (!deltaEl) return;
          const sign = delta >= 0 ? '↑' : '↓';
          const col  = delta >= 0 ? '#059669' : '#dc2626';
          // Insert small delta line below the balance number
          let sub = document.getElementById('finance-balance-delta');
          if (!sub) {
            sub = document.createElement('div');
            sub.id = 'finance-balance-delta';
            sub.style.cssText = 'font-size:.65rem;font-weight:600;margin-top:.1rem';
            deltaEl.parentElement.appendChild(sub);
          }
          sub.style.color = col;
          sub.textContent = `${sign} ${App.formatMoney(Math.abs(delta))} vs. ${MONTH_CS_SHORT[prevM-1]}`;
        });
    })();

    renderCategoryChart(catTotals, expense);

    if (!_txData.length) {
      el.innerHTML = `<div class="empty-state">
        <div class="empty-icon">💸</div>
        <div class="empty-title">Žádné transakce v tomto měsíci</div>
        <div class="empty-text">Zaznamenejte první příjem nebo výdaj.</div>
        <button class="btn btn-primary" style="margin-top:1rem" onclick="document.getElementById('addTxBtn').click()">+ Přidat transakci →</button>
      </div>`;
      return;
    }
    _renderTxList(_txData);
  }

  function renderCategoryChart(catTotals, total) {
    const el = document.getElementById('cat-chart');
    if (!el) return;
    if (!total) { el.innerHTML = '<div style="color:var(--text-muted);font-size:.875rem">Zatím žádné výdaje.</div>'; return; }
    const sorted = Object.entries(catTotals).sort((a, b) => b[1] - a[1]).slice(0, 6);
    el.innerHTML = sorted.map(([cat, amt]) => {
      const info = CATEGORIES[cat] ?? CATEGORIES.ostatní;
      const pct  = Math.round(amt / total * 100);
      return `<div style="margin-bottom:.625rem;border-radius:8px;padding:.35rem .45rem;transition:background .15s;cursor:default"
        onmouseover="this.style.background='var(--surface3)';this.querySelector('.cat-bar-fill').style.opacity='1';this.querySelector('.cat-bar-fill').style.transform='scaleY(1.6)'"
        onmouseout="this.style.background='';this.querySelector('.cat-bar-fill').style.opacity='.85';this.querySelector('.cat-bar-fill').style.transform='scaleY(1)'">
        <div style="display:flex;justify-content:space-between;font-size:.8125rem;margin-bottom:.3rem">
          <span>${info.emoji} ${info.label}</span>
          <span style="font-weight:600">${App.formatMoney(amt)} <span style="font-weight:400;color:var(--text-muted)">(${pct}%)</span></span>
        </div>
        <div class="progress-bar" style="height:6px;border-radius:3px">
          <div class="progress-fill cat-bar-fill" style="width:${pct}%;background:${info.color};height:6px;border-radius:3px;opacity:.85;transform-origin:left center;transition:opacity .15s,transform .15s"></div>
        </div>
      </div>`;
    }).join('');
  }

  function openAddTx() {
    const today = new Date().toISOString().split('T')[0];
    const catOpts = Object.entries(CATEGORIES).filter(([k]) => k !== 'příjem').map(([k, v]) =>
      `<option value="${k}">${v.emoji} ${v.label}</option>`).join('');
    App.openModal('💸 Nová transakce', `
      <!-- Jednorázová / Opakující se toggle -->
      <div style="display:flex;gap:0;border:1px solid var(--border);border-radius:8px;overflow:hidden;margin-bottom:1rem">
        <button id="tx-mode-once" onclick="Finance._setTxMode('once')"
          style="flex:1;padding:.45rem;font-size:.82rem;font-weight:600;background:var(--primary);color:#fff;border:none;cursor:pointer">
          📅 Jednorázová
        </button>
        <button id="tx-mode-rec" onclick="Finance._setTxMode('rec')"
          style="flex:1;padding:.45rem;font-size:.82rem;font-weight:600;background:transparent;color:var(--text-muted);border:none;cursor:pointer;border-left:1px solid var(--border)">
          🔁 Opakující se
        </button>
      </div>
      <div class="form-group">
        <label class="form-label">Název / Popis *</label>
        <input id="tx-desc" class="form-control" placeholder="např. Nákup Lidl, Výplata, Nájem…">
      </div>
      <div class="form-row">
        <div class="form-group">
          <label class="form-label">Typ *</label>
          <select id="tx-type" class="form-control" onchange="Finance.onTypeChange(this.value)">
            <option value="výdaj">💸 Výdaj</option>
            <option value="příjem">💰 Příjem</option>
          </select>
        </div>
        <div class="form-group" id="tx-date-group">
          <label class="form-label">Datum *</label>
          <input id="tx-date" type="date" class="form-control" value="${today}">
        </div>
        <div class="form-group" id="tx-day-group" style="display:none">
          <label class="form-label">Den v měsíci</label>
          <input id="tx-day" type="number" class="form-control" value="1" min="1" max="28">
        </div>
      </div>
      <div class="form-row">
        <div class="form-group">
          <label class="form-label">Částka (Kč) *</label>
          <input id="tx-amount" type="number" class="form-control" placeholder="0" min="0" step="1">
        </div>
        <div class="form-group">
          <label class="form-label">Kategorie</label>
          <select id="tx-category" class="form-control">${catOpts}</select>
        </div>
      </div>
      <div class="form-group">
        <label class="form-label">Člen rodiny</label>
        <select id="tx-member" class="form-control">
          <option value="">— nespecifikováno</option>
          <option value="Jakub">👤 Jakub</option>
          <option value="Adriana">👤 Adriana</option>
        </select>
      </div>
    `, { saveLabel: 'Přidat', onSave: saveTx });
  }

  function _setTxMode(mode) {
    const isRec = mode === 'rec';
    document.getElementById('tx-mode-once').style.background  = isRec ? 'transparent' : 'var(--primary)';
    document.getElementById('tx-mode-once').style.color       = isRec ? 'var(--text-muted)' : '#fff';
    document.getElementById('tx-mode-rec').style.background   = isRec ? 'var(--primary)' : 'transparent';
    document.getElementById('tx-mode-rec').style.color        = isRec ? '#fff' : 'var(--text-muted)';
    document.getElementById('tx-date-group').style.display    = isRec ? 'none' : '';
    document.getElementById('tx-day-group').style.display     = isRec ? '' : 'none';
    document.getElementById('tx-date-group').querySelector('input').required = !isRec;
  }

  function onTypeChange(val) {
    const catSel = document.getElementById('tx-category');
    if (!catSel) return;
    if (val === 'příjem') {
      catSel.innerHTML = `<option value="příjem">💰 Příjem</option>`;
    } else {
      catSel.innerHTML = Object.entries(CATEGORIES).filter(([k]) => k !== 'příjem').map(([k, v]) =>
        `<option value="${k}">${v.emoji} ${v.label}</option>`
      ).join('');
    }
  }

  async function saveTx() {
    const desc     = document.getElementById('tx-desc')?.value.trim();
    const amount   = parseFloat(document.getElementById('tx-amount')?.value);
    const type     = document.getElementById('tx-type')?.value;
    const category = document.getElementById('tx-category')?.value;
    const member   = document.getElementById('tx-member')?.value || null;
    const isRec    = document.getElementById('tx-day-group')?.style.display !== 'none';
    if (!desc)   { App.toast('Zadejte název / popis transakce.', 'error'); return; }
    if (!amount) { App.toast('Zadejte částku.', 'error'); return; }

    if (isRec) {
      const day = parseInt(document.getElementById('tx-day')?.value) || 1;
      const { error } = await db.from('recurring_transactions').insert({
        name: desc, amount, type,
        category: type === 'příjem' ? 'příjem' : (category ?? 'ostatní'),
        day_of_month: day, active: true,
      });
      if (error) { App.toast('Chyba: ' + error.message, 'error'); return; }
      App.toast('Opakující se transakce přidána ✓', 'success');
      App.closeModal();
      _switchTab('opakujici');
    } else {
      const date = document.getElementById('tx-date')?.value;
      if (!date) { App.toast('Zadejte datum.', 'error'); return; }
      const { error } = await db.from('finance_transactions').insert({
        amount, date, type,
        category: type === 'příjem' ? 'příjem' : category,
        description: desc,
        member: member || null,
      });
      if (error) { App.toast('Chyba: ' + error.message, 'error'); return; }
      App.toast('Přidáno ✓', 'success');
      App.closeModal();
      loadTransactions();
    }
  }

  async function editTx(id) {
    const { data: t } = await db.from('finance_transactions').select('*').eq('id', id).single();
    if (!t) return;
    App.openModal('✏️ Upravit transakci', `
      <div class="form-row">
        <div class="form-group">
          <label class="form-label">Typ</label>
          <select id="tx-type" class="form-control" onchange="Finance.onTypeChange(this.value)">
            <option value="výdaj" ${t.type==='výdaj'?'selected':''}>💸 Výdaj</option>
            <option value="příjem" ${t.type==='příjem'?'selected':''}>💰 Příjem</option>
          </select>
        </div>
        <div class="form-group">
          <label class="form-label">Datum</label>
          <input id="tx-date" type="date" class="form-control" value="${t.date}">
        </div>
      </div>
      <div class="form-row">
        <div class="form-group">
          <label class="form-label">Částka (Kč)</label>
          <input id="tx-amount" type="number" class="form-control" value="${t.amount}" min="0" step="1">
        </div>
        <div class="form-group">
          <label class="form-label">Kategorie</label>
          <select id="tx-category" class="form-control">
            ${Object.entries(CATEGORIES).map(([k, v]) =>
              `<option value="${k}" ${t.category===k?'selected':''}>${v.emoji} ${v.label}</option>`
            ).join('')}
          </select>
        </div>
      </div>
      <div class="form-group">
        <label class="form-label">Popis</label>
        <input id="tx-desc" class="form-control" value="${App.esc(t.description ?? '')}">
      </div>
    `, {
      saveLabel: 'Uložit',
      onSave: async () => {
        const amount = parseFloat(document.getElementById('tx-amount')?.value);
        const date   = document.getElementById('tx-date')?.value;
        if (!amount || !date) { App.toast('Vyplňte povinná pole.', 'error'); return; }
        const { error } = await db.from('finance_transactions').update({
          amount, date,
          type:     document.getElementById('tx-type')?.value,
          category: document.getElementById('tx-category')?.value,
          description: document.getElementById('tx-desc')?.value.trim() || null,
        }).eq('id', id);
        if (error) { App.toast('Chyba: ' + error.message, 'error'); return; }
        App.toast('Uloženo ✓', 'success');
        App.closeModal();
        loadTransactions();
      }
    });
  }

  async function deleteTx(id) {
    if (!confirm('Smazat transakci?')) return;
    const { error } = await db.from('finance_transactions').delete().eq('id', id);
    if (error) { App.toast('Chyba: ' + error.message, 'error'); return; }
    App.toast('Smazáno.', '');
    loadTransactions();
  }

  // ── Cíle spoření ──────────────────────────────
  async function loadGoals() {
    const el = document.getElementById('goals-list');
    const { data, error } = await db.from('finance_goals').select('*').order('created_at');
    if (error || !data?.length) {
      el.innerHTML = `<div class="empty-state" style="padding:1.5rem">
        <div class="empty-icon">🎯</div>
        <div class="empty-title">Žádné cíle spoření</div>
        <button class="btn btn-outline btn-sm" style="margin-top:.75rem" onclick="document.getElementById('addGoalBtn').click()">+ Nastavit cíl →</button>
      </div>`;
      return;
    }
    el.innerHTML = data.map(g => {
      const pct = Math.min(100, Math.round(g.current / g.target * 100));
      return `<div class="goal-card" style="margin-bottom:.75rem">
        <div class="goal-header">
          <span class="goal-name">${App.esc(g.name)}</span>
          <div style="display:flex;gap:.375rem">
            <button class="btn btn-icon btn-ghost btn-sm" onclick="Finance.addToGoal('${g.id}','${App.esc(g.name)}',${g.target},${g.current})">➕</button>
            <button class="btn btn-icon btn-ghost btn-sm" onclick="Finance.deleteGoal('${g.id}')">🗑️</button>
          </div>
        </div>
        ${g.deadline ? `<div style="font-size:.78rem;color:var(--text-muted);margin-bottom:.375rem">📅 Do ${App.formatDate(g.deadline)}</div>` : ''}
        <div class="progress-bar" style="height:10px">
          <div class="progress-fill" style="width:${pct}%;background:${g.color ?? 'var(--primary)'}"></div>
        </div>
        <div class="goal-amounts">
          <span>${App.formatMoney(g.current)}</span>
          <span style="font-weight:700;color:${g.color ?? 'var(--primary)'}">${pct}%</span>
          <span>${App.formatMoney(g.target)}</span>
        </div>
      </div>`;
    }).join('');
  }

  function openAddGoal() {
    App.openModal('🎯 Nový cíl spoření', `
      <div class="form-group">
        <label class="form-label">Název *</label>
        <input id="goal-name" class="form-control" placeholder="např. Dovolená Chorvatsko">
      </div>
      <div class="form-row">
        <div class="form-group">
          <label class="form-label">Cílová částka (Kč) *</label>
          <input id="goal-target" type="number" class="form-control" placeholder="100000" min="1">
        </div>
        <div class="form-group">
          <label class="form-label">Aktuálně naspořeno (Kč)</label>
          <input id="goal-current" type="number" class="form-control" placeholder="0" min="0">
        </div>
      </div>
      <div class="form-row">
        <div class="form-group">
          <label class="form-label">Deadline</label>
          <input id="goal-deadline" type="date" class="form-control">
        </div>
        <div class="form-group">
          <label class="form-label">Barva</label>
          <input id="goal-color" type="color" class="form-control" value="#6366f1" style="height:44px;padding:.25rem">
        </div>
      </div>
    `, {
      saveLabel: 'Přidat cíl',
      onSave: async () => {
        const name   = document.getElementById('goal-name')?.value.trim();
        const target = parseFloat(document.getElementById('goal-target')?.value);
        if (!name || !target) { App.toast('Vyplňte název a cíl.', 'error'); return; }
        const { error } = await db.from('finance_goals').insert({
          name, target,
          current:  parseFloat(document.getElementById('goal-current')?.value) || 0,
          deadline: document.getElementById('goal-deadline')?.value || null,
          color:    document.getElementById('goal-color')?.value,
        });
        if (error) { App.toast('Chyba: ' + error.message, 'error'); return; }
        App.toast('Cíl přidán ✓', 'success');
        App.closeModal();
        loadGoals();
      }
    });
  }

  function addToGoal(id, name, target, current) {
    App.openModal(`➕ Přidat k cíli — ${App.esc(name)}`, `
      <div class="form-group">
        <label class="form-label">Přidat částku (Kč)</label>
        <input id="goal-add" type="number" class="form-control" placeholder="0" min="0" autofocus>
      </div>
      <div style="font-size:.875rem;color:var(--text-muted)">Aktuální stav: ${App.formatMoney(current)} / ${App.formatMoney(target)}</div>
    `, {
      saveLabel: 'Přidat',
      onSave: async () => {
        const add    = parseFloat(document.getElementById('goal-add')?.value) || 0;
        const newVal = Math.min(target, current + add);
        const { error } = await db.from('finance_goals').update({ current: newVal }).eq('id', id);
        if (error) { App.toast('Chyba: ' + error.message, 'error'); return; }
        App.toast('Aktualizováno ✓', 'success');
        App.closeModal();
        loadGoals();
      }
    });
  }

  async function deleteGoal(id) {
    if (!confirm('Smazat cíl spoření?')) return;
    await db.from('finance_goals').delete().eq('id', id);
    App.toast('Smazáno.', '');
    loadGoals();
  }

  // ── Opakující se transakce ────────────────────
  function daysUntilPayment(dayOfMonth) {
    const today = new Date();
    const d = today.getDate();
    if (dayOfMonth >= d) return dayOfMonth - d;
    const next = new Date(today.getFullYear(), today.getMonth() + 1, dayOfMonth);
    return Math.ceil((next - today) / 86400000);
  }

  function payBarColor(days) {
    if (days <= 3)  return '#ef4444';
    if (days <= 7)  return '#f97316';
    if (days <= 14) return '#eab308';
    return '#22c55e';
  }

  async function loadRecurring() {
    const el = document.getElementById('recurring-list');
    if (!el) return;

    const { data, error } = await db.from('recurring_transactions').select('*').order('name');
    if (error) { el.innerHTML = `<div class="empty-state"><div class="empty-text">Chyba: ${App.esc(error.message)}</div></div>`; return; }

    if (!data?.length) {
      el.innerHTML = `<div class="empty-state" style="padding:2rem">
        <div class="empty-icon">🔁</div>
        <div class="empty-title">Žádné opakující se transakce</div>
        <div class="empty-text">Přidejte nájem, hypotéku, energie nebo plat.</div>
        <button class="btn btn-primary" style="margin-top:1rem" onclick="document.getElementById('addRecurringBtn').click()">+ Přidat opakující se →</button>
      </div>`;
      return;
    }

    const monthlyIncome  = data.filter(r => r.active && r.type === 'příjem').reduce((s, r) => s + parseFloat(r.amount), 0);
    const monthlyExpense = data.filter(r => r.active && r.type === 'výdaj').reduce((s, r) => s + parseFloat(r.amount), 0);
    const net = monthlyIncome - monthlyExpense;

    // ── Forecast timeline ────────────────────────────────────────────────
    const today = new Date();
    const allUpcoming = data
      .filter(r => r.active && r.type === 'výdaj')
      .map(r => ({ ...r, daysLeft: daysUntilPayment(r.day_of_month) }))
      .sort((a, b) => a.daysLeft - b.daysLeft);

    const upcoming14 = allUpcoming.filter(r => r.daysLeft <= 14);

    let forecastHtml = '';
    if (allUpcoming.length) {
      const total14 = upcoming14.reduce((s, r) => s + parseFloat(r.amount), 0);
      const nextMonth = new Date(today.getFullYear(), today.getMonth() + 1, 1);
      const pad2 = n => String(n).padStart(2,'0');

      const timelineRows = allUpcoming.slice(0, 8).map(r => {
        const days = r.daysLeft;
        const color = payBarColor(days);
        const cat = CATEGORIES[r.category] ?? CATEGORIES.ostatní;
        // Compute the actual upcoming payment date
        const payDay = r.day_of_month;
        const payDate = days === 0
          ? today
          : new Date(today.getFullYear(), today.getMonth(), payDay) > today
            ? new Date(today.getFullYear(), today.getMonth(), payDay)
            : new Date(today.getFullYear(), today.getMonth() + 1, payDay);
        const dateLabel = `${pad2(payDate.getDate())}.${pad2(payDate.getMonth()+1)}.`;
        const daysLabel = days === 0 ? '<span style="color:#ef4444;font-weight:700">Dnes</span>'
          : days === 1 ? '<span style="color:#f97316;font-weight:700">Zítra</span>'
          : `<span style="color:${color}">za ${days} dní</span>`;
        const barPct = Math.max(4, Math.min(100, Math.round((1 - days / 31) * 100)));
        return `<div style="display:flex;align-items:center;gap:.625rem;padding:.45rem .5rem;border-radius:8px;background:var(--surface2);margin-bottom:.3rem">
          <span style="font-size:1rem;width:1.4rem;text-align:center">${cat.emoji}</span>
          <div style="flex:1;min-width:0">
            <div style="font-size:.83rem;font-weight:600;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${App.esc(r.name)}</div>
            <div style="display:flex;align-items:center;gap:.4rem;margin-top:.2rem">
              <div style="width:60px;height:3px;background:var(--border);border-radius:2px;flex-shrink:0">
                <div style="width:${barPct}%;height:100%;background:${color};border-radius:2px"></div>
              </div>
              <span style="font-size:.7rem;color:var(--text-muted)">${dateLabel} · ${daysLabel}</span>
            </div>
          </div>
          <span style="font-size:.875rem;font-weight:700;color:#ef4444;white-space:nowrap">−${App.formatMoney(r.amount)}</span>
        </div>`;
      }).join('');

      forecastHtml = `
        <div style="border:1px solid var(--border);border-radius:12px;padding:.75rem .875rem;margin-bottom:1rem;background:var(--surface)">
          <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:.625rem">
            <span style="font-size:.72rem;font-weight:700;letter-spacing:.06em;color:var(--text-muted)">⚡ NADCHÁZEJÍCÍ PLATBY</span>
            ${upcoming14.length ? `<span style="font-size:.75rem;background:#fef3c7;color:#92400e;border-radius:20px;padding:.1rem .55rem;font-weight:600">do 14 dní: −${App.formatMoney(total14)}</span>` : ''}
          </div>
          ${timelineRows}
        </div>`;
    }

    el.innerHTML = `
      ${forecastHtml}
      <div style="display:flex;gap:1rem;margin-bottom:1rem;flex-wrap:wrap">
        <div class="kpi-card" style="flex:1;min-width:110px;padding:.75rem">
          <div class="kpi-label">Příjmy</div>
          <div style="font-size:1.05rem;font-weight:700;color:var(--success)">${App.formatMoney(monthlyIncome)}</div>
        </div>
        <div class="kpi-card" style="flex:1;min-width:110px;padding:.75rem">
          <div class="kpi-label">Výdaje</div>
          <div style="font-size:1.05rem;font-weight:700;color:var(--danger)">${App.formatMoney(monthlyExpense)}</div>
        </div>
        <div class="kpi-card" style="flex:1;min-width:110px;padding:.75rem">
          <div class="kpi-label">Čistý měsíčně</div>
          <div style="font-size:1.05rem;font-weight:700;color:${net >= 0 ? 'var(--success)' : 'var(--danger)'}">${App.formatMoney(net)}</div>
        </div>
      </div>
      <div style="max-height:380px;overflow-y:auto;display:flex;flex-direction:column;gap:.375rem;padding-right:2px">
        ${data.map(r => {
          const cat = CATEGORIES[r.category] ?? CATEGORIES.ostatní;
          const isIncome = r.type === 'příjem';
          const days = daysUntilPayment(r.day_of_month);
          const barColor = isIncome ? '#22c55e' : payBarColor(days);
          const barPct = Math.max(0, Math.min(100, Math.round((1 - days / 31) * 100)));
          const dayLabel = days === 0 ? 'Dnes' : `za ${days}d`;
          return `<div class="tx-item" style="${r.active ? '' : 'opacity:.5'}">
            <div style="font-size:1.05rem">${cat.emoji}</div>
            <div class="tx-body">
              <div class="tx-desc">${App.esc(r.name)}</div>
              <div class="tx-meta">${r.day_of_month}. · ${cat.label}${r.active ? '' : ' · <span style="color:var(--text-light)">neaktivní</span>'}</div>
              ${r.active ? `<div style="display:flex;align-items:center;gap:.4rem;margin-top:.2rem">
                <div style="flex:1;height:3px;background:var(--border);border-radius:2px;overflow:hidden;max-width:80px">
                  <div style="width:${barPct}%;height:100%;background:${barColor};border-radius:2px"></div>
                </div>
                <span style="font-size:.68rem;color:${barColor};font-weight:600">${dayLabel}</span>
              </div>` : ''}
            </div>
            <div class="tx-amount ${isIncome ? 'income' : 'expense'}">${isIncome ? '+' : '−'}${App.formatMoney(r.amount)}</div>
            <div class="tx-actions">
              <button class="btn btn-icon btn-ghost btn-sm" onclick="Finance.toggleRecurring('${r.id}',${r.active})" title="${r.active ? 'Deaktivovat' : 'Aktivovat'}">${r.active ? '⏸' : '▶'}</button>
              <button class="btn btn-icon btn-ghost btn-sm" onclick="Finance.deleteRecurring('${r.id}')">🗑️</button>
            </div>
          </div>`;
        }).join('')}
      </div>
      <div style="display:flex;justify-content:flex-end;align-items:center;padding:.625rem .25rem 0;border-top:1px solid var(--border);margin-top:.5rem;font-size:.875rem;color:var(--text-muted)">
        Celkem aktivních: <strong style="margin-left:.5rem;color:var(--text)">${data.filter(r=>r.active).length} položek</strong>
        <span style="margin-left:1rem">Výdaje:</span>
        <strong style="margin-left:.35rem;color:var(--danger)">${App.formatMoney(monthlyExpense)}</strong>
      </div>`;
  }

  function openAddRecurring() {
    App.openModal('🔁 Nová opakující se transakce', `
      <div class="form-group">
        <label class="form-label">Název *</label>
        <input id="rec-name" class="form-control" placeholder="např. Nájem, Hypotéka, Plat">
      </div>
      <div class="form-row">
        <div class="form-group">
          <label class="form-label">Typ *</label>
          <select id="rec-type" class="form-control" onchange="Finance.onRecTypeChange(this.value)">
            <option value="výdaj">💸 Výdaj</option>
            <option value="příjem">💰 Příjem</option>
          </select>
        </div>
        <div class="form-group">
          <label class="form-label">Částka (Kč) *</label>
          <input id="rec-amount" type="number" class="form-control" placeholder="0" min="0">
        </div>
      </div>
      <div class="form-row">
        <div class="form-group">
          <label class="form-label">Kategorie *</label>
          <select id="rec-category" class="form-control">
            ${Object.entries(CATEGORIES).filter(([k]) => k !== 'příjem').map(([k, v]) =>
              `<option value="${k}">${v.emoji} ${v.label}</option>`
            ).join('')}
          </select>
        </div>
        <div class="form-group">
          <label class="form-label">Den v měsíci</label>
          <input id="rec-day" type="number" class="form-control" value="1" min="1" max="28">
        </div>
      </div>
    `, {
      saveLabel: 'Přidat',
      onSave: async () => {
        const name   = document.getElementById('rec-name')?.value.trim();
        const amount = parseFloat(document.getElementById('rec-amount')?.value);
        const type   = document.getElementById('rec-type')?.value;
        if (!name || !amount) { App.toast('Vyplňte název a částku.', 'error'); return; }
        const { error } = await db.from('recurring_transactions').insert({
          name, amount, type,
          category:     type === 'příjem' ? 'příjem' : (document.getElementById('rec-category')?.value ?? 'ostatní'),
          day_of_month: parseInt(document.getElementById('rec-day')?.value) || 1,
          active:       true,
        });
        if (error) { App.toast('Chyba: ' + error.message, 'error'); return; }
        App.toast('Přidáno ✓', 'success');
        App.closeModal();
        loadRecurring();
      }
    });
  }

  function onRecTypeChange(val) {
    const catSel = document.getElementById('rec-category');
    if (!catSel) return;
    if (val === 'příjem') {
      catSel.innerHTML = `<option value="příjem">💰 Příjem</option>`;
    } else {
      catSel.innerHTML = Object.entries(CATEGORIES).filter(([k]) => k !== 'příjem').map(([k, v]) =>
        `<option value="${k}">${v.emoji} ${v.label}</option>`
      ).join('');
    }
  }

  async function toggleRecurring(id, active) {
    await db.from('recurring_transactions').update({ active: !active }).eq('id', id);
    loadRecurring();
  }

  async function deleteRecurring(id) {
    if (!confirm('Smazat opakující se transakci?')) return;
    await db.from('recurring_transactions').delete().eq('id', id);
    App.toast('Smazáno.', '');
    loadRecurring();
  }

  // ── Správa dat (smazání) ─────────────────────
  function openManageData() {
    const curY = new Date().getFullYear();
    const years = [curY, curY - 1, curY - 2];
    const months = ['Leden','Únor','Březen','Duben','Květen','Červen','Červenec','Srpen','Září','Říjen','Listopad','Prosinec'];
    App.openModal('🗑️ Správa transakcí', `
      <div style="background:#fef3c7;border:1px solid #f59e0b;border-radius:8px;padding:.75rem 1rem;margin-bottom:1rem;font-size:.82rem">
        ⚠️ Smazání je nevratné. Používejte pro odstranění duplicit z vícenásobného importu.
      </div>
      <div class="form-group">
        <label class="form-label">Smazat konkrétní měsíc</label>
        <div style="display:flex;gap:.5rem;flex-wrap:wrap">
          <select id="del-year" class="form-control" style="flex:1;min-width:80px">
            ${years.map(y => `<option value="${y}">${y}</option>`).join('')}
          </select>
          <select id="del-month" class="form-control" style="flex:2;min-width:120px">
            ${months.map((m, i) => `<option value="${i+1}">${m}</option>`).join('')}
          </select>
          <button class="btn btn-outline" style="color:var(--danger);border-color:var(--danger)"
            onclick="Finance._deleteMonth()">Smazat měsíc</button>
        </div>
      </div>
      <div class="form-group" style="margin-top:1.25rem;padding-top:1.25rem;border-top:1px solid var(--border)">
        <label class="form-label">Smazat vše</label>
        <div style="display:flex;align-items:center;gap:.75rem">
          <input id="del-confirm" class="form-control" placeholder='Napište "smazat vše" pro potvrzení' style="flex:1">
          <button class="btn btn-outline" style="color:var(--danger);border-color:var(--danger);white-space:nowrap"
            onclick="Finance._deleteAll()">Smazat vše</button>
        </div>
      </div>
      <div id="del-status" style="margin-top:.75rem;font-size:.82rem;color:var(--text-muted)"></div>
    `, {});
  }

  async function _deleteMonth() {
    const year  = parseInt(document.getElementById('del-year')?.value);
    const month = parseInt(document.getElementById('del-month')?.value);
    const pad   = n => String(n).padStart(2, '0');
    const from  = `${year}-${pad(month)}-01`;
    const last  = new Date(year, month, 0).getDate();
    const to    = `${year}-${pad(month)}-${pad(last)}`;
    const statusEl = document.getElementById('del-status');
    statusEl.textContent = 'Mažu…';
    const { error, count } = await db.from('finance_transactions').delete({ count: 'exact' }).gte('date', from).lte('date', to);
    if (error) { statusEl.textContent = 'Chyba: ' + error.message; statusEl.style.color = 'var(--danger)'; return; }
    statusEl.textContent = `Smazáno ${count ?? '?'} transakcí za ${from.slice(0,7)}.`;
    statusEl.style.color = 'var(--success)';
    loadTransactions();
  }

  async function _deleteAll() {
    const val = document.getElementById('del-confirm')?.value.trim().toLowerCase();
    if (val !== 'smazat vše') { App.toast('Napište přesně "smazat vše"', 'error'); return; }
    const statusEl = document.getElementById('del-status');
    statusEl.textContent = 'Mažu vše…';
    const { error, count } = await db.from('finance_transactions').delete({ count: 'exact' }).gte('date', '2000-01-01');
    if (error) { statusEl.textContent = 'Chyba: ' + error.message; statusEl.style.color = 'var(--danger)'; return; }
    statusEl.textContent = `Smazáno ${count ?? 'všechny'} transakcí.`;
    statusEl.style.color = 'var(--success)';
    loadTransactions();
  }

  // ── Import bankovního výpisu ──────────────────
  function guessCategory(desc) {
    const d = (desc || '').toLowerCase();
    if (/albert|lidl|billa|kaufland|tesco|penny|globus|potraviny|zelenin|pekarn|coop\b|grocery/i.test(d)) return 'potraviny';
    if (/mcdonald|kfc|subway|pizza|restaurac|kavárna|kavarna|bistro|burger|sushi|steak|kebab|fastfood/i.test(d)) return 'volný čas';
    if (/shell|mol\b|benzin|pohonné|pohonne|easypark|parkov|dálnic|dalnic|myčka|myjka|autoumyv/i.test(d)) return 'auto';
    if (/netflix|spotify|youtube|dazn|hbo\b|disney|prime video|steam|playstation|xbox|alza|czc\b/i.test(d)) return 'volný čas';
    if (/lékárna|lekarna|doktor|ordinac|zdravot|hospital|nemocnic|dr\.|mudr/i.test(d)) return 'zdraví';
    if (/elektřina|plyn\b|energie|vodné|stočné|internet|telefon|mobil|o2\b|t-mobile|vodafone|cetin/i.test(d)) return 'domácnost';
    if (/nájem|najem|hypotéka|hypoteka|nájemné|najemne|pojistné|pojistna|pojistovna/i.test(d)) return 'bydlení';
    if (/ikea|hornbach|obi\b|baumax|bauhaus|mall\.cz|datart/i.test(d)) return 'domácnost';
    if (/h&m|zara|primark|sportis|decathlon|oblečení|obleceni|dm\b|drogeri/i.test(d)) return 'ostatní';
    return 'ostatní';
  }

  function guessMember(desc) {
    const d = (desc || '').toLowerCase();
    // Sdílené/domácnostní platby — nepřiřazovat nikomu
    if (/trval[ýy]\s*p[řr][íi]kaz|inkaso|sipo|pojišt[ěe]n[íi]/.test(d)) return '';
    if (/\btát[ay]\b|\bmám[ay]\b/.test(d)) return '';                // rodinné platby
    if (/gamma\s*o2|ob[ěe]d|jídeln[ay]|kantýn[ay]/.test(d)) return ''; // obědy v práci
    if (/n[áa]jem|energie|elektřin[ay]|plyn|vod[ay]|internet|tv\s*kabel/.test(d)) return ''; // domácnost
    // Platba konkrétní osoby — jméno v popisu
    if (/\bjakub\b/.test(d)) return 'Jakub';
    if (/\badrian[a]?\b/.test(d)) return 'Adriana';
    return '';
  }

  async function parseAirBankPDF(file) {
    if (typeof pdfjsLib === 'undefined') {
      App.toast('PDF.js se nenačetl — obnov stránku a zkus znovu.', 'error');
      return [];
    }
    pdfjsLib.GlobalWorkerOptions.workerSrc =
      'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';

    let pdf;
    try {
      pdf = await pdfjsLib.getDocument({ data: await file.arrayBuffer() }).promise;
    } catch (e) {
      App.toast('Nelze otevřít PDF: ' + e.message, 'error');
      return [];
    }

    // Collect all text items from all pages with position info
    const allItems = [];
    for (let p = 1; p <= pdf.numPages; p++) {
      const tc = await (await pdf.getPage(p)).getTextContent();
      for (const it of tc.items) {
        if (it.str.trim()) allItems.push({ p, x: it.transform[4], y: it.transform[5], t: it.str });
      }
    }

    if (!allItems.length) {
      App.toast('PDF neobsahuje čitelný text — je soubor skenovaný?', 'error');
      return [];
    }

    // Sort: page asc → Y desc (top to bottom) → X asc (left to right)
    allItems.sort((a, b) => a.p !== b.p ? a.p - b.p : b.y - a.y || a.x - b.x);

    // Group into visual lines with 6pt Y tolerance
    const lines = [];
    for (const it of allItems) {
      const prev = lines[lines.length - 1];
      if (prev && prev.p === it.p && Math.abs(prev.y - it.y) <= 6) {
        prev.items.push(it);
      } else {
        lines.push({ p: it.p, y: it.y, items: [it] });
      }
    }

    const DATE_TOK = /^\d{2}\.\d{2}\.\d{4}$/;
    const CZ_NUM   = /^-?\d{1,4}(?:[ \u00a0]\d{3})*,\d{2}$/;
    const SKIP     = /zaúčtování|provedení|výpis|strana|saldo|celkem|datum|kód transakce|název|detaily/i;

    const rows = [];
    for (const line of lines) {
      line.items.sort((a, b) => a.x - b.x);
      const toks = line.items.map(i => i.t.trim()).filter(Boolean);
      if (!toks.length) continue;

      // Transaction row must start with a date token
      if (!DATE_TOK.test(toks[0])) continue;
      if (SKIP.test(toks.join(' '))) continue;

      // Collect indices of Czech-format number tokens
      const numIdxs = [];
      toks.forEach((t, i) => { if (CZ_NUM.test(t)) numIdxs.push(i); });
      if (numIdxs.length < 2) continue;

      // Second-to-last number = transaction amount; last = fees
      const amountIdx = numIdxs[numIdxs.length - 2];
      const amount    = parseFloat(toks[amountIdx].replace(/[ \u00a0]/g, '').replace(',', '.'));
      if (isNaN(amount) || amount === 0) continue;

      const dp  = toks[0].split('.');
      const day = parseInt(dp[0]), mon = parseInt(dp[1]), yr = parseInt(dp[2]);
      // Validate: create the date and confirm it didn't overflow (e.g. Apr 31 → May 1)
      const testDate = new Date(yr, mon - 1, day);
      if (testDate.getFullYear() !== yr || testDate.getMonth() !== mon - 1 || testDate.getDate() !== day) continue;
      const dateStr = `${yr}-${String(mon).padStart(2,'0')}-${String(day).padStart(2,'0')}`;

      // Description: skip the two leading dates, take everything before the amount
      let start = 1;
      if (toks[1] && DATE_TOK.test(toks[1])) start = 2;
      const desc = toks.slice(start, amountIdx).join(' ').trim();

      rows.push({
        date:        dateStr,
        amount:      Math.abs(amount),
        type:        amount > 0 ? 'příjem' : 'výdaj',
        description: desc,
        category:    guessCategory(desc),
        member:      guessMember(desc),
      });
    }

    if (!rows.length) {
      App.toast(`PDF načteno (${allItems.length} textových položek), ale nebyla rozpoznána žádná transakce. Zkontroluj formát výpisu.`, 'error');
    }
    return rows;
  }

  function openImport() {
    App.openModal('📥 Import bankovního výpisu', `
      <div class="form-group">
        <label class="form-label">Soubory z banky</label>
        <input type="file" id="importFile" accept=".csv,.txt,.pdf" multiple class="form-control" style="padding:.5rem">
        <div style="font-size:.78rem;color:var(--text-muted);margin-top:.375rem">
          Podporuje: <strong>Air Bank PDF</strong>, <strong>Fio CSV</strong> a obecný CSV formát.<br>
          Lze vybrat <strong>více souborů najednou</strong> (různé měsíce) — transakce se sloučí a seřadí podle data.
          Kategorie se přiřadí automaticky.
        </div>
      </div>
    `, {
      saveLabel: 'Načíst soubory',
      onSave: async () => {
        const files = [...(document.getElementById('importFile')?.files ?? [])];
        if (!files.length) { App.toast('Vyber alespoň jeden soubor', 'error'); return; }
        App.toast(`Načítám ${files.length} soubor${files.length > 1 ? 'y' : ''}…`, '');
        const allRows = [];
        for (const file of files) {
          let rows;
          if (file.name.toLowerCase().endsWith('.pdf')) {
            rows = await parseAirBankPDF(file);
          } else {
            rows = parseCSVBank(await file.text());
          }
          allRows.push(...rows);
        }
        if (!allRows.length) return;
        // Sort by date ascending across all files
        allRows.sort((a, b) => a.date.localeCompare(b.date));
        showImportPreview(allRows, 'ostatní');
      }
    });
  }

  function parseCSVBank(text) {
    const lines = text.split('\n').map(l => l.trim()).filter(l => l);
    // Detect Fio format: contains "Datum" and "Objem" in a header line
    const fioIdx = lines.findIndex(l => l.includes('Datum') && l.includes('Objem'));
    if (fioIdx !== -1) return parseFio(lines.slice(fioIdx));
    return parseGenericCSV(lines);
  }

  function parseFio(lines) {
    const header = lines[0].split(';').map(h => h.replace(/"/g, '').trim());
    const di = header.findIndex(h => h === 'Datum');
    const ai = header.findIndex(h => h === 'Objem');
    const pi = header.findIndex(h => h.includes('Zpráva') || h.includes('Protiúčet') || h.includes('Název') || h.includes('Poznámka'));
    const rows = [];
    for (let i = 1; i < lines.length; i++) {
      const c = lines[i].split(';').map(x => x.replace(/^"|"$/g, '').trim());
      if (!c[di]) continue;
      const dp = c[di].split('.');
      if (dp.length !== 3) continue;
      const dateStr = `${dp[2]}-${dp[1].padStart(2,'0')}-${dp[0].padStart(2,'0')}`;
      const amount = parseFloat((c[ai]||'').replace(/\s/g,'').replace(',','.'));
      if (isNaN(amount) || amount === 0) continue;
      rows.push({ date: dateStr, amount: Math.abs(amount), type: amount > 0 ? 'příjem' : 'výdaj', description: pi >= 0 ? c[pi] : '' });
    }
    return rows;
  }

  function parseGenericCSV(lines) {
    const sep = lines[0]?.includes(';') ? ';' : ',';
    const rows = [];
    const start = /\d{2}[.\-/]\d{2}[.\-/]\d{4}|\d{4}-\d{2}-\d{2}/.test(lines[0]) ? 0 : 1;
    for (let i = start; i < lines.length; i++) {
      const c = lines[i].split(sep).map(x => x.replace(/^"|"$/g,'').trim());
      if (c.length < 2) continue;
      let dateStr = '', amount = NaN, desc = '';
      for (const col of c) {
        if (!dateStr) {
          const m = col.match(/^(\d{2})[.\-/](\d{2})[.\-/](\d{4})$/);
          if (m) { dateStr = `${m[3]}-${m[2]}-${m[1]}`; continue; }
          if (/^\d{4}-\d{2}-\d{2}$/.test(col)) { dateStr = col; continue; }
        }
        if (isNaN(amount)) {
          const n = parseFloat(col.replace(/\s/g,'').replace(',','.'));
          if (!isNaN(n) && n !== 0) { amount = n; continue; }
        }
        if (!desc && col.length > 2) desc = col;
      }
      if (dateStr && !isNaN(amount)) rows.push({ date: dateStr, amount: Math.abs(amount), type: amount > 0 ? 'příjem' : 'výdaj', description: desc });
    }
    return rows;
  }

  function showImportPreview(rows, defaultCat) {
    const MEMBERS = ['', 'Jakub', 'Adriana'];
    const enriched = rows.map((r, i) => ({
      ...r,
      category: r.type === 'příjem' ? 'příjem' : (r.category || defaultCat),
      member: r.member || '',
      idx: i,
    }));
    App.openModal('📥 Náhled importu — ' + rows.length + ' transakcí', `
      <div style="font-size:.8rem;color:var(--text-muted);margin-bottom:.75rem">
        Zaškrtni transakce k importu. Člen a kategorie jsou předvyplněny automaticky — uprav dle potřeby.
      </div>
      <div style="max-height:360px;overflow-y:auto;border:1px solid var(--border);border-radius:var(--radius)">
        <table style="width:100%;border-collapse:collapse;font-size:.75rem">
          <thead style="position:sticky;top:0;background:var(--surface2)">
            <tr>
              <th style="padding:.35rem .4rem;width:20px"><input type="checkbox" id="importSelAll" checked onchange="document.querySelectorAll('.imp-chk').forEach(c=>c.checked=this.checked)"></th>
              <th style="padding:.35rem .4rem;text-align:left">Datum</th>
              <th style="padding:.35rem .4rem;text-align:left">Popis</th>
              <th style="padding:.35rem .4rem;text-align:right">Částka</th>
              <th style="padding:.35rem .4rem;text-align:left">Kategorie</th>
              <th style="padding:.35rem .4rem;text-align:left">Člen</th>
            </tr>
          </thead>
          <tbody>
            ${enriched.map(r => {
              const catOpts = Object.entries(CATEGORIES).map(([k,v]) =>
                `<option value="${k}" ${r.category===k?'selected':''}>${v.emoji} ${v.label}</option>`
              ).join('');
              const memOpts = MEMBERS.map(m =>
                `<option value="${m}" ${r.member===m?'selected':''}>${m || '—'}</option>`
              ).join('');
              const sel = `style="font-size:.7rem;padding:.1rem .25rem;border:1px solid var(--border);border-radius:4px;background:var(--surface)"`;
              return `<tr style="border-bottom:1px solid var(--border)" data-idx="${r.idx}">
                <td style="padding:.25rem .4rem"><input type="checkbox" class="imp-chk" checked></td>
                <td style="padding:.25rem .4rem;white-space:nowrap">${r.date}</td>
                <td style="padding:.25rem .4rem;max-width:130px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap" title="${App.esc(r.description)}">${App.esc(r.description||'—')}</td>
                <td style="padding:.25rem .4rem;text-align:right;font-weight:600;color:${r.type==='příjem'?'var(--success)':'var(--danger)'}">
                  ${r.type==='příjem'?'+':'−'}${App.formatMoney(r.amount)}</td>
                <td style="padding:.25rem .4rem"><select class="imp-cat" ${sel}>${catOpts}</select></td>
                <td style="padding:.25rem .4rem"><select class="imp-mem" ${sel}>${memOpts}</select></td>
              </tr>`;
            }).join('')}
          </tbody>
        </table>
      </div>
    `, {
      saveLabel: 'Importovat',
      onSave: async () => {
        const trs = document.querySelectorAll('#modal tbody tr');
        const toInsert = [];
        trs.forEach((tr, i) => {
          if (!tr.querySelector('.imp-chk')?.checked) return;
          const cat = tr.querySelector('.imp-cat')?.value ?? 'ostatní';
          const mem = tr.querySelector('.imp-mem')?.value ?? '';
          toInsert.push({
            date: enriched[i].date, amount: enriched[i].amount,
            type: cat === 'příjem' ? 'příjem' : 'výdaj',
            category: cat,
            description: enriched[i].description || null,
            member: mem || null,
          });
        });
        if (!toInsert.length) { App.toast('Žádné transakce k importu', 'error'); return; }
        const { error } = await db.from('finance_transactions').insert(toInsert);
        if (error) { App.toast('Chyba: ' + error.message, 'error'); return; }

        // Navigate to the month of the earliest imported transaction
        const dates = toInsert.map(r => r.date).sort();
        const [yr, mo] = dates[0].split('-').map(Number);
        currentYear  = yr;
        currentMonth = mo;
        setMonthLabel();

        // Collect unique months for the toast
        const months = [...new Set(toInsert.map(r => r.date.slice(0,7)))].sort();
        const MONTH_CS = ['led','úno','bře','dub','kvě','čer','čvc','srp','zář','říj','lis','pro'];
        const monthLabels = months.map(m => { const [y,mo2] = m.split('-'); return `${MONTH_CS[+mo2-1]} ${y}`; }).join(', ');
        App.toast(`Importováno ${toInsert.length} transakcí (${monthLabels}) ✓`, 'success');
        App.closeModal();
        _switchTab('jednorazove');
      }
    });
  }

  // ── Měsíční detail ───────────────────────────
  async function showMonthDetail(year, month) {
    const MONTH_CS = ['Leden','Únor','Březen','Duben','Květen','Červen','Červenec','Srpen','Září','Říjen','Listopad','Prosinec'];
    const pad = n => String(n).padStart(2,'0');
    const from = `${year}-${pad(month)}-01`;
    const to   = `${year}-${pad(month)}-${pad(new Date(year, month, 0).getDate())}`;
    const { data, error } = await db.from('finance_transactions').select('*').gte('date', from).lte('date', to).order('date', { ascending: false });
    if (error) { App.toast('Chyba: ' + error.message, 'error'); return; }

    const catTotals = {}, memberTotals = {};
    let totalExp = 0, totalInc = 0;
    (data ?? []).forEach(t => {
      const amt = parseFloat(t.amount);
      if (t.type === 'příjem') { totalInc += amt; }
      else {
        totalExp += amt;
        catTotals[t.category] = (catTotals[t.category] ?? 0) + amt;
        if (t.member) memberTotals[t.member] = (memberTotals[t.member] ?? 0) + amt;
      }
    });

    const memberHtml = Object.keys(memberTotals).length ? `
      <div style="margin-bottom:1rem">
        <div style="font-size:.7rem;font-weight:700;letter-spacing:.06em;color:var(--text-muted);margin-bottom:.4rem">UTRÁCELI</div>
        ${Object.entries(memberTotals).sort((a,b)=>b[1]-a[1]).map(([m, amt]) => {
          const pct = totalExp > 0 ? Math.round(amt / totalExp * 100) : 0;
          return `<div style="display:flex;align-items:center;gap:.5rem;margin-bottom:.35rem">
            <span style="font-size:.875rem;min-width:70px">👤 ${App.esc(m)}</span>
            <div style="flex:1;height:6px;background:var(--border);border-radius:3px;overflow:hidden">
              <div style="width:${pct}%;height:100%;background:var(--primary);border-radius:3px"></div>
            </div>
            <span style="font-size:.8rem;font-weight:600;color:var(--danger);white-space:nowrap">−${App.formatMoney(amt)}</span>
            <span style="font-size:.7rem;color:var(--text-muted)">${pct}%</span>
          </div>`;
        }).join('')}
      </div>` : '';

    const catHtml = Object.keys(catTotals).length ? `
      <div style="margin-bottom:1rem">
        <div style="font-size:.7rem;font-weight:700;letter-spacing:.06em;color:var(--text-muted);margin-bottom:.4rem">KATEGORIE</div>
        ${Object.entries(catTotals).sort((a,b)=>b[1]-a[1]).slice(0,8).map(([cat, amt]) => {
          const info = CATEGORIES[cat] ?? CATEGORIES.ostatní;
          const pct = totalExp > 0 ? Math.round(amt / totalExp * 100) : 0;
          return `<div style="margin-bottom:.45rem">
            <div style="display:flex;justify-content:space-between;font-size:.8rem;margin-bottom:.2rem">
              <span>${info.emoji} ${info.label}</span>
              <span style="font-weight:600">${App.formatMoney(amt)} <span style="font-weight:400;color:var(--text-muted)">(${pct}%)</span></span>
            </div>
            <div class="progress-bar"><div class="progress-fill" style="width:${pct}%;background:${info.color}"></div></div>
          </div>`;
        }).join('')}
      </div>` : '';

    const txHtml = (data ?? []).length ? `
      <div style="font-size:.7rem;font-weight:700;letter-spacing:.06em;color:var(--text-muted);margin-bottom:.4rem">TRANSAKCE (${data.length})</div>
      <div style="max-height:220px;overflow-y:auto;display:flex;flex-direction:column;gap:.2rem">
        ${data.map(t => {
          const cat = CATEGORIES[t.category] ?? CATEGORIES.ostatní;
          const isInc = t.type === 'příjem';
          return `<div style="display:flex;align-items:center;gap:.5rem;padding:.3rem .4rem;border-radius:6px;background:var(--surface2)">
            <span>${cat.emoji}</span>
            <div style="flex:1;min-width:0">
              <div style="font-size:.78rem;font-weight:500;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${App.esc(t.description || cat.label)}</div>
              <div style="font-size:.68rem;color:var(--text-muted)">${App.formatDate(t.date)}${t.member ? ' · 👤 ' + App.esc(t.member) : ''}</div>
            </div>
            <span style="font-size:.82rem;font-weight:700;color:${isInc?'var(--success)':'var(--danger)'};white-space:nowrap">${isInc?'+':'−'}${App.formatMoney(t.amount)}</span>
          </div>`;
        }).join('')}
      </div>` : '<div style="color:var(--text-muted);font-size:.875rem">Žádné transakce.</div>';

    App.openModal(`📊 ${MONTH_CS[month-1]} ${year}`, `
      <div style="display:flex;gap:.5rem;margin-bottom:1rem;flex-wrap:wrap">
        <div class="kpi-card" style="flex:1;padding:.6rem"><div class="kpi-label">Příjmy</div><div style="font-weight:700;color:var(--success);font-size:1rem">${App.formatMoney(totalInc)}</div></div>
        <div class="kpi-card" style="flex:1;padding:.6rem"><div class="kpi-label">Výdaje</div><div style="font-weight:700;color:var(--danger);font-size:1rem">${App.formatMoney(totalExp)}</div></div>
        <div class="kpi-card" style="flex:1;padding:.6rem"><div class="kpi-label">Bilance</div><div style="font-weight:700;color:${totalInc-totalExp>=0?'var(--success)':'var(--danger)'};font-size:1rem">${App.formatMoney(totalInc-totalExp)}</div></div>
      </div>
      ${memberHtml}${catHtml}${txHtml}
    `, {});
  }

  return { load, editTx, deleteTx, deleteGoal, addToGoal, onTypeChange, onRecTypeChange, toggleRecurring, deleteRecurring, openImport, openManageData, _deleteMonth, _deleteAll, setChartMode, showMonthDetail, openMonthPicker, _pickMonth, filterTx, _setTxMode };
})();

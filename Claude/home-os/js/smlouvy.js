/* ═══════════════════════════════════════════════
   Home OS — modul Smlouvy
   ═══════════════════════════════════════════════ */

const Smlouvy = (() => {
  let _bound = false;
  let _activeTab = 'smlouvy';

  const TYPES = [
    { value: 'pojištění-auto',      label: 'Pojištění auta',      emoji: '🚗', color: '#3b82f6' },
    { value: 'pojištění-domácnost', label: 'Pojištění domácnosti', emoji: '🏠', color: '#8b5cf6' },
    { value: 'pojištění-život',     label: 'Životní pojištění',    emoji: '❤️', color: '#ec4899' },
    { value: 'pojištění-jiné',      label: 'Pojištění jiné',       emoji: '🛡️', color: '#6366f1' },
    { value: 'energie-elektřina',   label: 'Elektřina',            emoji: '⚡', color: '#f59e0b' },
    { value: 'energie-plyn',        label: 'Plyn',                 emoji: '🔥', color: '#ef4444' },
    { value: 'energie-voda',        label: 'Voda',                 emoji: '💧', color: '#06b6d4' },
    { value: 'internet',            label: 'Internet',             emoji: '🌐', color: '#10b981' },
    { value: 'telefon',             label: 'Telefon / TV',         emoji: '📱', color: '#6366f1' },
    { value: 'jiné',                label: 'Jiné',                 emoji: '📋', color: '#94a3b8' },
  ];

  function typeInfo(value) {
    return TYPES.find(t => t.value === value) ?? TYPES[TYPES.length - 1];
  }

  // ── Load ──────────────────────────────────────
  function load() {
    if (!_bound) {
      document.getElementById('addContractBtn')?.addEventListener('click', openAdd);
      document.getElementById('addWarrantyBtn')?.addEventListener('click', openAddWarranty);

      // Tab switching
      document.querySelectorAll('#page-smlouvy .tab-btn').forEach(btn => {
        btn.addEventListener('click', () => {
          _activeTab = btn.dataset.tab;
          document.querySelectorAll('#page-smlouvy .tab-btn').forEach(b => b.classList.remove('active'));
          document.querySelectorAll('#page-smlouvy .tab-panel').forEach(p => p.classList.remove('active'));
          btn.classList.add('active');
          document.getElementById(`sml-tab-${_activeTab}`)?.classList.add('active');
          _showActionBtn();
          _loadTab(_activeTab);
        });
      });

      _bound = true;
    }
    _activeTab = 'smlouvy';
    document.querySelectorAll('#page-smlouvy .tab-btn').forEach(b => b.classList.remove('active'));
    document.querySelectorAll('#page-smlouvy .tab-panel').forEach(p => p.classList.remove('active'));
    document.querySelector('#page-smlouvy .tab-btn[data-tab="smlouvy"]')?.classList.add('active');
    document.getElementById('sml-tab-smlouvy')?.classList.add('active');
    _showActionBtn();
    loadContracts();
  }

  function _showActionBtn() {
    const addContract = document.getElementById('addContractBtn');
    const addWarranty = document.getElementById('addWarrantyBtn');
    if (addContract) addContract.style.display = _activeTab === 'smlouvy' ? '' : 'none';
    if (addWarranty) addWarranty.style.display = _activeTab === 'zaruky' ? '' : 'none';
  }

  function _loadTab(tab) {
    if (tab === 'smlouvy') loadContracts();
    else if (tab === 'zaruky') loadWarranties();
  }

  // ── Warranties ────────────────────────────────
  async function loadWarranties() {
    const el = document.getElementById('warranties-list');
    if (!el) return;
    el.innerHTML = '<div class="loading"><div class="spinner"></div> Načítám…</div>';

    const { data, error } = await db.from('warranties').select('*').order('warranty_end');

    if (error) { el.innerHTML = `<div class="empty-state"><div class="empty-text">Chyba: ${App.esc(error.message)}</div></div>`; return; }

    if (!data?.length) {
      el.innerHTML = `<div class="empty-state">
        <div class="empty-icon">📦</div>
        <div class="empty-title">Žádné záruky</div>
        <div class="empty-text">Přidejte spotřebiče a jejich záruky.</div>
        <button class="btn btn-primary" style="margin-top:1rem" onclick="Smlouvy.openAddWarranty()">+ Přidat záruku</button>
      </div>`;
      return;
    }

    el.innerHTML = `<div style="display:flex;flex-direction:column;gap:.5rem">` + data.map(w => {
      const days = w.warranty_end ? App.daysUntil(w.warranty_end) : null;
      return `<div class="contract-card" style="border-left:3px solid ${days !== null && days < 0 ? '#ef4444' : days !== null && days <= 60 ? '#f59e0b' : '#10b981'}">
        <div class="contract-summary" onclick="this.nextElementSibling.classList.toggle('open')">
          <span style="font-size:1.1rem;flex-shrink:0">📦</span>
          <div style="flex:1;min-width:0">
            <div style="font-weight:600;font-size:.9rem;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${App.esc(w.name)}</div>
            <div style="font-size:.75rem;color:var(--text-muted)">${w.store ? App.esc(w.store) : 'Spotřebič'}${w.purchase_date ? ' · ' + App.formatDate(w.purchase_date) : ''}</div>
          </div>
          <div style="display:flex;align-items:center;gap:.5rem;flex-shrink:0">
            ${days !== null ? App.countdownBadge(days) : w.warranty_end ? `<span style="font-size:.78rem;color:var(--text-muted)">${App.formatDate(w.warranty_end)}</span>` : ''}
            <span style="color:var(--text-light);font-size:.7rem">▾</span>
          </div>
        </div>
        <div class="contract-details">
          ${w.warranty_end ? `<div class="contract-detail-row"><span>Záruka do</span><strong>${App.formatDate(w.warranty_end)}</strong></div>` : ''}
          ${w.price ? `<div class="contract-detail-row"><span>Cena</span><span>${App.formatMoney(w.price)}</span></div>` : ''}
          ${w.notes ? `<div style="font-size:.78rem;color:var(--text-muted);margin-top:.375rem;padding:.375rem .5rem;background:var(--surface2);border-radius:4px">${App.esc(w.notes)}</div>` : ''}
          <div style="display:flex;gap:.375rem;margin-top:.625rem">
            <button class="btn btn-sm btn-outline" style="color:var(--danger)" onclick="event.stopPropagation();Smlouvy.deleteWarranty('${w.id}')">Smazat</button>
          </div>
        </div>
      </div>`;
    }).join('') + `</div>`;
  }

  function openAddWarranty() {
    App.openModal('Nová záruka', `
      <div class="form-group">
        <label class="form-label">Název spotřebiče *</label>
        <input id="w-name" class="form-control" placeholder="např. Pračka Bosch">
      </div>
      <div class="form-row">
        <div class="form-group">
          <label class="form-label">Obchod</label>
          <input id="w-store" class="form-control" placeholder="Alza, Datart…">
        </div>
        <div class="form-group">
          <label class="form-label">Cena (Kč)</label>
          <input id="w-price" type="number" class="form-control" placeholder="0">
        </div>
      </div>
      <div class="form-row">
        <div class="form-group">
          <label class="form-label">Datum koupě</label>
          <input id="w-bought" type="date" class="form-control">
        </div>
        <div class="form-group">
          <label class="form-label">Záruka do</label>
          <input id="w-end" type="date" class="form-control">
        </div>
      </div>
      <div class="form-group">
        <label class="form-label">Poznámka</label>
        <input id="w-notes" class="form-control" placeholder="číslo dokladu, sériové číslo…">
      </div>
    `, {
      saveLabel: 'Přidat',
      onSave: async () => {
        const name = document.getElementById('w-name')?.value.trim();
        if (!name) { App.toast('Zadejte název.', 'error'); return; }
        const { error } = await db.from('warranties').insert({
          name,
          store:        document.getElementById('w-store')?.value.trim() || null,
          price:        parseFloat(document.getElementById('w-price')?.value) || null,
          purchase_date: document.getElementById('w-bought')?.value || null,
          warranty_end:  document.getElementById('w-end')?.value || null,
          notes:        document.getElementById('w-notes')?.value.trim() || null,
        });
        if (error) { App.toast('Chyba: ' + error.message, 'error'); return; }
        App.toast('Záruka přidána ✓', 'success');
        App.closeModal();
        loadWarranties();
      }
    });
  }

  async function deleteWarranty(id) {
    if (!confirm('Opravdu smazat tuto záruku?')) return;
    const { error } = await db.from('warranties').delete().eq('id', id);
    if (error) { App.toast('Chyba: ' + error.message, 'error'); return; }
    App.toast('Záruka smazána.', '');
    loadWarranties();
  }

  // ── Load contracts ────────────────────────────
  async function loadContracts() {
    const el = document.getElementById('contracts-list');
    if (!el) return;
    el.innerHTML = '<div class="loading"><div class="spinner"></div> Načítám…</div>';

    const { data, error } = await db
      .from('contracts')
      .select('*')
      .order('end_date');

    if (error) {
      el.innerHTML = `<div class="empty-state"><div class="empty-text">Chyba: ${App.esc(error.message)}</div></div>`;
      return;
    }

    // KPI
    const totalAnnual = (data ?? []).reduce((sum, c) => sum + (parseFloat(c.amount) || 0), 0);
    const kpiEl = document.getElementById('contracts-kpi');
    if (kpiEl) {
      kpiEl.innerHTML = `
        <div class="kpi-card" style="flex:1;min-width:140px">
          <div class="kpi-label">Smluv celkem</div>
          <div class="kpi-value">${(data ?? []).length}</div>
        </div>
        <div class="kpi-card" style="flex:1;min-width:140px">
          <div class="kpi-label">Roční náklady</div>
          <div class="kpi-value" style="color:var(--danger)">${App.formatMoney(totalAnnual)}</div>
        </div>
        <div class="kpi-card" style="flex:1;min-width:140px">
          <div class="kpi-label">Měsíčně</div>
          <div class="kpi-value">${App.formatMoney(totalAnnual / 12)}</div>
        </div>`;
    }

    if (!data?.length) {
      el.innerHTML = `<div class="empty-state">
        <div class="empty-icon">📄</div>
        <div class="empty-title">Žádné smlouvy</div>
        <div class="empty-text">Přidejte pojistky, energie, internet nebo jiné smlouvy a sledujte jejich platnost.</div>
        <button class="btn btn-primary" style="margin-top:1rem" onclick="Smlouvy.openAdd()">+ Přidat smlouvu →</button>
      </div>`;
      return;
    }

    // Seřadit podle naléhavosti (nejblíže výpovědní lhůtě první)
    const sorted = [...data].sort((a, b) => {
      const urgA = a.end_date ? App.daysUntil(a.end_date) - (a.notice_period_days ?? 30) : Infinity;
      const urgB = b.end_date ? App.daysUntil(b.end_date) - (b.notice_period_days ?? 30) : Infinity;
      return urgA - urgB;
    });

    el.innerHTML = `<div style="display:flex;flex-direction:column;gap:.75rem">
      ${sorted.map(c => renderCard(c)).join('')}
    </div>`;
  }

  // ── Urgency badge (3 tiers) ───────────────────
  function urgencyBadge(days) {
    if (days < 0)   return `<span class="countdown alert">Po lhůtě!</span>`;
    if (days <= 30) return `<span class="countdown warn">Za ${days} dní</span>`;
    if (days <= 90) return `<span class="countdown" style="background:#fef9c3;color:#92400e;border:1px solid #fef08a">Za ${days} dní</span>`;
    return `<span class="countdown ok">Za ${days} dní</span>`;
  }

  // ── Render card ───────────────────────────────
  function renderCard(c) {
    const info       = typeInfo(c.type);
    const noticeDays = c.notice_period_days ?? 30;
    const urgency    = c.end_date ? App.daysUntil(c.end_date) - noticeDays : null;
    const accentColor = urgency !== null && urgency <= 0  ? '#ef4444'
                      : urgency !== null && urgency <= 30 ? '#f59e0b'
                      : urgency !== null && urgency <= 90 ? '#eab308'
                      : info.color;

    const urgentBanner = urgency !== null && urgency <= 0
      ? `<div style="font-size:.78rem;font-weight:600;color:#dc2626;background:#fee2e2;padding:.35rem .625rem;border-radius:4px;margin-bottom:.5rem">Výpovědní lhůta vypršela — obnoví se automaticky</div>`
      : urgency !== null && urgency <= 30
      ? `<div style="font-size:.78rem;font-weight:600;color:#92400e;background:#fef9c3;padding:.35rem .625rem;border-radius:4px;margin-bottom:.5rem">⚠️ Za ${urgency} dní vyprší výpovědní lhůta</div>`
      : urgency !== null && urgency <= 90
      ? `<div style="font-size:.78rem;font-weight:600;color:#713f12;background:#fefce8;padding:.35rem .625rem;border-radius:4px;margin-bottom:.5rem">Za ${urgency} dní vyprší výpovědní lhůta</div>`
      : '';

    return `<div class="contract-card" style="border-left:3px solid ${accentColor}">
      <div class="contract-summary" onclick="this.nextElementSibling.classList.toggle('open')">
        <span style="font-size:1.1rem;flex-shrink:0">${info.emoji}</span>
        <div style="flex:1;min-width:0">
          <div style="font-weight:600;font-size:.9rem;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${App.esc(c.name)}</div>
          <div style="font-size:.75rem;color:var(--text-muted)">${info.label}${c.provider ? ' · ' + App.esc(c.provider) : ''}</div>
        </div>
        <div style="display:flex;align-items:center;gap:.5rem;flex-shrink:0">
          ${urgency !== null ? urgencyBadge(urgency) : c.end_date ? `<span style="font-size:.78rem;color:var(--text-muted)">${App.formatDate(c.end_date)}</span>` : ''}
          <span style="color:var(--text-light);font-size:.7rem">▾</span>
        </div>
      </div>
      <div class="contract-details">
        ${urgentBanner}
        ${c.end_date ? `<div class="contract-detail-row"><span>Platnost do</span><strong>${App.formatDate(c.end_date)}</strong></div>` : ''}
        ${c.start_date ? `<div class="contract-detail-row"><span>Od</span><span>${App.formatDate(c.start_date)}</span></div>` : ''}
        <div class="contract-detail-row"><span>Výpovědní lhůta</span><span>${noticeDays} dní</span></div>
        ${c.amount ? `<div class="contract-detail-row"><span>Roční náklady</span><strong>${App.formatMoney(parseFloat(c.amount))}</strong></div>` : ''}
        ${c.auto_renew ? `<div style="font-size:.78rem;color:var(--text-muted);margin-top:.25rem">Automatické obnovení</div>` : ''}
        ${c.notes ? `<div style="font-size:.78rem;color:var(--text-muted);margin-top:.375rem;padding:.375rem .5rem;background:var(--surface2);border-radius:4px">${App.esc(c.notes)}</div>` : ''}
        <div style="display:flex;gap:.375rem;margin-top:.625rem">
          <button class="btn btn-sm btn-outline" onclick="event.stopPropagation();Smlouvy.openEdit('${c.id}')">Upravit</button>
          <button class="btn btn-sm btn-outline" onclick="event.stopPropagation();Docs.open('contract','${c.id}','${App.esc(c.name)}')">📎 Přílohy</button>
          <button class="btn btn-sm btn-outline" style="color:var(--danger)" onclick="event.stopPropagation();Smlouvy.deleteContract('${c.id}')">Smazat</button>
        </div>
      </div>
    </div>`;
  }

  // ── Modal form HTML ───────────────────────────
  function modalBody(c = {}) {
    const typeOptions = TYPES.map(t =>
      `<option value="${t.value}" ${c.type === t.value ? 'selected' : ''}>${t.emoji} ${t.label}</option>`
    ).join('');

    return `
      <div class="form-group">
        <label class="form-label">Název *</label>
        <input id="c-name" class="form-control" placeholder="např. Pojištění vozidla, ČEZ elektřina…" value="${App.esc(c.name ?? '')}">
      </div>
      <div class="form-row">
        <div class="form-group">
          <label class="form-label">Typ</label>
          <select id="c-type" class="form-control">
            ${typeOptions}
          </select>
        </div>
        <div class="form-group">
          <label class="form-label">Poskytovatel</label>
          <input id="c-provider" class="form-control" placeholder="např. Kooperativa, ČEZ…" value="${App.esc(c.provider ?? '')}">
        </div>
      </div>
      <div class="form-row">
        <div class="form-group">
          <label class="form-label">Datum začátku</label>
          <input id="c-start" type="date" class="form-control" value="${c.start_date ?? ''}">
        </div>
        <div class="form-group">
          <label class="form-label">Datum konce / obnovy</label>
          <input id="c-end" type="date" class="form-control" value="${c.end_date ?? ''}">
        </div>
      </div>
      <div class="form-row">
        <div class="form-group">
          <label class="form-label">Výpovědní lhůta (dní)</label>
          <input id="c-notice" type="number" class="form-control" min="0" placeholder="30" value="${c.notice_period_days ?? 30}">
        </div>
        <div class="form-group">
          <label class="form-label">Roční náklady (Kč)</label>
          <input id="c-amount" type="number" class="form-control" min="0" step="1" placeholder="0" value="${c.amount ?? ''}">
        </div>
      </div>
      <div class="form-group" style="display:flex;align-items:center;gap:.625rem;padding:.375rem 0">
        <input id="c-renew" type="checkbox" style="width:1.125rem;height:1.125rem;cursor:pointer;accent-color:var(--primary)" ${c.auto_renew !== false ? 'checked' : ''}>
        <label for="c-renew" class="form-label" style="margin:0;cursor:pointer">🔄 Automatické obnovení smlouvy</label>
      </div>
      <div class="form-group">
        <label class="form-label">Poznámky</label>
        <textarea id="c-notes" class="form-control" rows="3" placeholder="Číslo smlouvy, kontakt, podmínky…">${App.esc(c.notes ?? '')}</textarea>
      </div>`;
  }

  // ── Collect form data ─────────────────────────
  function collectData() {
    return {
      name:               document.getElementById('c-name')?.value.trim() || null,
      type:               document.getElementById('c-type')?.value || 'jiné',
      provider:           document.getElementById('c-provider')?.value.trim() || null,
      start_date:         document.getElementById('c-start')?.value || null,
      end_date:           document.getElementById('c-end')?.value || null,
      notice_period_days: parseInt(document.getElementById('c-notice')?.value) || 30,
      amount:             parseFloat(document.getElementById('c-amount')?.value) || null,
      auto_renew:         document.getElementById('c-renew')?.checked ?? true,
      notes:              document.getElementById('c-notes')?.value.trim() || null,
    };
  }

  // ── Open add modal ────────────────────────────
  function openAdd() {
    App.openModal('📄 Nová smlouva', modalBody(), {
      saveLabel: 'Přidat smlouvu',
      onSave: async () => {
        const data = collectData();
        if (!data.name) { App.toast('Zadejte název smlouvy.', 'error'); return; }
        const { error } = await db.from('contracts').insert(data);
        if (error) { App.toast('Chyba: ' + error.message, 'error'); return; }
        App.toast('Smlouva přidána ✓', 'success');
        App.closeModal();
        loadContracts();
      }
    });
  }

  // ── Open edit modal ───────────────────────────
  async function openEdit(id) {
    const { data: c, error } = await db.from('contracts').select('*').eq('id', id).single();
    if (error || !c) { App.toast('Nepodařilo se načíst smlouvu.', 'error'); return; }

    App.openModal('✏️ Upravit smlouvu', modalBody(c), {
      saveLabel: 'Uložit změny',
      onSave: async () => {
        const data = collectData();
        if (!data.name) { App.toast('Zadejte název smlouvy.', 'error'); return; }
        const { error: updErr } = await db.from('contracts').update(data).eq('id', id);
        if (updErr) { App.toast('Chyba: ' + updErr.message, 'error'); return; }
        App.toast('Uloženo ✓', 'success');
        App.closeModal();
        loadContracts();
      }
    });
  }

  // ── Delete ────────────────────────────────────
  async function deleteContract(id) {
    if (!confirm('Opravdu smazat tuto smlouvu?')) return;
    const { error } = await db.from('contracts').delete().eq('id', id);
    if (error) { App.toast('Chyba: ' + error.message, 'error'); return; }
    App.toast('Smlouva smazána.', '');
    loadContracts();
  }

  return { load, openAdd, openEdit, deleteContract, openAddWarranty, deleteWarranty };
})();

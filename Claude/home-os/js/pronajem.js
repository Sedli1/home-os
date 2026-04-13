/* ═══════════════════════════════════════════════
   Home OS — modul Pronájem
   ═══════════════════════════════════════════════ */

const Pronajem = (() => {
  let properties = [];
  let _bound = false;
  let _loadGen = 0;

  async function load() {
    const gen = ++_loadGen;
    const el = document.getElementById('pronajem-list');
    el.innerHTML = '<div class="loading"><div class="spinner"></div> Načítám…</div>';

    if (!_bound) {
      document.getElementById('addPropertyBtn')?.addEventListener('click', openAddProperty);
      _bound = true;
    }

    const { data, error } = await db
      .from('rental_properties')
      .select(`*, rental_tenants(*)`)
      .order('name');

    if (gen !== _loadGen) return;
    if (error) { el.innerHTML = `<div class="empty-state"><div class="empty-text">Chyba: ${App.esc(error.message)}</div></div>`; return; }
    properties = data ?? [];

    if (!properties.length) {
      el.innerHTML = `<div class="empty-state">
        <div class="empty-icon">🏘️</div>
        <div class="empty-title">Žádné nemovitosti</div>
        <div class="empty-text">Přidejte první nemovitost a začněte sledovat nájemníky a platby.</div>
        <button class="btn btn-primary" style="margin-top:1rem" onclick="document.getElementById('addPropertyBtn').click()">+ Přidat nemovitost →</button>
      </div>`;
      return;
    }

    el.innerHTML = '';
    for (const prop of properties) {
      if (gen !== _loadGen) return;
      el.appendChild(await renderProperty(prop));
    }
  }

  async function renderProperty(prop) {
    const wrap = document.createElement('div');
    wrap.className = 'property-card';

    const allTenants   = prop.rental_tenants ?? [];
    const activeTenants = allTenants.filter(t => t.active);
    const pastTenants   = allTenants.filter(t => !t.active);
    const tenant = activeTenants[0] ?? null;

    const year = new Date().getFullYear();
    let payments = [];
    if (tenant) {
      const { data } = await db
        .from('rental_payments')
        .select('*')
        .eq('tenant_id', tenant.id)
        .gte('month', `${year}-01`)
        .lte('month', `${year}-12`);
      payments = data ?? [];
    }

    const payMap = {};
    payments.forEach(p => { payMap[p.month] = p; });

    const today    = new Date();
    const todayStr = `${year}-${String(today.getMonth() + 1).padStart(2, '0')}`;

    const months = Array.from({ length: 12 }, (_, i) => {
      const m = String(i + 1).padStart(2, '0');
      return `${year}-${m}`;
    });

    // Zjistit dlužné měsíce
    const overdueMonths = months.filter(month => {
      const isFuture = month > todayStr;
      if (isFuture) return false;
      const p = payMap[month];
      return !p?.paid;
    });

    const payGrid = months.map(month => {
      const p = payMap[month];
      const monthNum = parseInt(month.split('-')[1]);
      const isFuture = month > todayStr;
      let cls;
      if (isFuture)      cls = 'future';
      else if (p?.paid)  cls = 'paid';
      else               cls = 'unpaid';
      const title = `${monthNum}/${year}${p?.paid ? ' — zaplaceno' : isFuture ? '' : ' — NEZAPLACENO'}`;
      return `<div class="payment-cell ${cls}" title="${title}"
        onclick="Pronajem.togglePayment('${tenant?.id ?? ''}','${month}',${p?.paid ? 'true' : 'false'},'${p?.id ?? ''}')"
        data-month="${month}">${monthNum}</div>`;
    }).join('');

    let contractBadge = '';
    if (tenant?.contract_end) {
      const days = App.daysUntil(tenant.contract_end);
      contractBadge = `<div style="margin-top:.5rem">${App.countdownBadge(days)} smlouva do ${App.formatDate(tenant.contract_end)}</div>`;
    }

    const overdueAlert = (tenant && overdueMonths.length > 0) ? `
      <div style="padding:.625rem 1.25rem;background:#fef2f2;border-top:1px solid #fecaca;display:flex;align-items:center;gap:.5rem">
        <span style="color:#dc2626;font-weight:600;font-size:.875rem">⚠️ Dlužný nájem: ${overdueMonths.length} měsíc${overdueMonths.length > 1 ? 'e' : ''}</span>
        <span style="color:#dc2626;font-size:.8rem">(${overdueMonths.map(m => parseInt(m.split('-')[1]) + '/' + m.split('-')[0]).join(', ')})</span>
      </div>` : '';

    const { data: repairs } = await db
      .from('rental_repairs')
      .select('*')
      .eq('property_id', prop.id)
      .neq('status', 'hotovo')
      .order('date', { ascending: false });

    // Historie nájemníků
    const historyHtml = pastTenants.length ? `
      <div style="padding:.75rem 1.25rem;border-top:1px solid var(--border)">
        <div style="font-size:.75rem;font-weight:600;color:var(--text-muted);text-transform:uppercase;letter-spacing:.04em;margin-bottom:.5rem;cursor:pointer" onclick="this.nextElementSibling.style.display=this.nextElementSibling.style.display==='none'?'block':'none'">
          📋 Historie nájemníků (${pastTenants.length}) ▾
        </div>
        <div style="display:none">
          ${pastTenants.map(t => `
            <div style="display:flex;justify-content:space-between;align-items:center;padding:.375rem 0;border-bottom:1px solid var(--border);font-size:.875rem">
              <div>
                <span style="font-weight:500">${App.esc(t.name)}</span>
                ${t.contract_start ? `<span style="color:var(--text-muted)"> · od ${App.formatDate(t.contract_start)}</span>` : ''}
                ${t.contract_end ? `<span style="color:var(--text-muted)"> do ${App.formatDate(t.contract_end)}</span>` : ''}
              </div>
              <div style="display:flex;align-items:center;gap:.5rem">
                ${t.rent_amount ? `<span style="color:var(--text-muted)">${App.formatMoney(t.rent_amount)}</span>` : ''}
                <button class="btn btn-sm btn-outline" onclick="Pronajem.reactivateTenant('${t.id}','${prop.id}')">Reaktivovat</button>
              </div>
            </div>`).join('')}
        </div>
      </div>` : '';

    wrap.innerHTML = `
      <div class="property-header">
        <div>
          <div class="property-name">🏠 ${App.esc(prop.name)}</div>
          ${prop.address ? `<div class="property-address">📍 ${App.esc(prop.address)}</div>` : ''}
        </div>
        <div style="display:flex;gap:.375rem">
          <button class="btn btn-sm btn-outline" onclick="Pronajem.openAddTenant('${prop.id}')">+ Nájemník</button>
          <button class="btn btn-sm btn-outline" onclick="Pronajem.openAddRepair('${prop.id}')">🔧 Oprava</button>
          <button class="btn btn-icon btn-ghost btn-sm" onclick="Pronajem.deleteProperty('${prop.id}')">🗑️</button>
        </div>
      </div>

      ${tenant ? `
      <div style="padding:.875rem 1.25rem;border-bottom:1px solid var(--border)">
        <div style="display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:.5rem">
          <div>
            <span style="font-weight:600">👤 ${App.esc(tenant.name)}</span>
            ${tenant.phone ? `<span style="color:var(--text-muted);font-size:.875rem"> · 📞 ${App.esc(tenant.phone)}</span>` : ''}
            ${tenant.email ? `<span style="color:var(--text-muted);font-size:.875rem"> · ✉️ ${App.esc(tenant.email)}</span>` : ''}
          </div>
          <div style="display:flex;align-items:center;gap:.5rem">
            <span style="font-weight:700;color:var(--success)">${App.formatMoney(tenant.rent_amount ?? 0)}/měs.</span>
            <button class="btn btn-icon btn-ghost btn-sm" onclick="Pronajem.editTenant('${tenant.id}')">✏️</button>
            <button class="btn btn-sm btn-ghost" onclick="Pronajem.deactivateTenant('${tenant.id}')" title="Ukončit nájem" style="font-size:.75rem;color:var(--text-muted)">Ukončit</button>
          </div>
        </div>
        ${contractBadge}
      </div>
      ${overdueAlert}
      <div style="padding:.5rem 1.25rem .25rem">
        <div style="font-size:.75rem;color:var(--text-muted);margin-bottom:.375rem;font-weight:600;text-transform:uppercase;letter-spacing:.04em">Platby ${year}</div>
        <div class="payment-grid">${payGrid}</div>
      </div>
      ` : `<div style="padding:1rem 1.25rem;color:var(--text-muted);font-size:.875rem">Žádný aktivní nájemník. <button class="btn btn-sm btn-outline" onclick="Pronajem.openAddTenant('${prop.id}')">+ Přidat</button></div>`}

      ${repairs?.length ? `
      <div style="padding:.75rem 1.25rem;border-top:1px solid var(--border);background:var(--surface2)">
        <div style="font-size:.75rem;font-weight:600;color:var(--warning);text-transform:uppercase;letter-spacing:.04em;margin-bottom:.375rem">🔧 Otevřené opravy (${repairs.length})</div>
        ${repairs.map(r => `<div style="font-size:.875rem;display:flex;justify-content:space-between;padding:.25rem 0;border-bottom:1px solid var(--border)">
          <span>${App.esc(r.description)}</span>
          <span style="display:flex;align-items:center;gap:.5rem">
            ${r.cost ? App.formatMoney(r.cost) : ''}
            <span class="badge badge-yellow">${r.status}</span>
            <button class="btn btn-icon btn-ghost btn-sm" onclick="Pronajem.closeRepair('${r.id}')">✓</button>
          </span>
        </div>`).join('')}
      </div>` : ''}
      ${historyHtml}
    `;

    return wrap;
  }

  async function togglePayment(tenantId, month, isPaid, existingId) {
    if (!tenantId) return;
    if (existingId) {
      await db.from('rental_payments').update({
        paid: !isPaid,
        paid_date: !isPaid ? new Date().toISOString().split('T')[0] : null
      }).eq('id', existingId);
    } else {
      const { data: tenant } = await db.from('rental_tenants').select('rent_amount').eq('id', tenantId).single();
      await db.from('rental_payments').insert({
        tenant_id: tenantId, month,
        amount: tenant?.rent_amount ?? 0,
        paid: true,
        paid_date: new Date().toISOString().split('T')[0]
      });
    }
    await load();
  }

  async function deactivateTenant(id) {
    if (!confirm('Ukončit nájem tohoto nájemníka? Přesune se do historie.')) return;
    await db.from('rental_tenants').update({ active: false }).eq('id', id);
    App.toast('Nájem ukončen.', '');
    load();
  }

  async function reactivateTenant(id, propId) {
    // Deaktivovat ostatní aktivní nájemníky na nemovitosti
    const prop = properties.find(p => p.id === propId);
    if (prop) {
      for (const t of (prop.rental_tenants ?? []).filter(t => t.active)) {
        await db.from('rental_tenants').update({ active: false }).eq('id', t.id);
      }
    }
    await db.from('rental_tenants').update({ active: true }).eq('id', id);
    App.toast('Nájemník reaktivován ✓', 'success');
    load();
  }

  function openAddProperty() {
    App.openModal('🏠 Nová nemovitost', `
      <div class="form-group">
        <label class="form-label">Název *</label>
        <input id="prop-name" class="form-control" placeholder="např. Byt Praha Žižkov">
      </div>
      <div class="form-group">
        <label class="form-label">Adresa</label>
        <input id="prop-address" class="form-control" placeholder="Ulice 12, Praha 3">
      </div>
      <div class="form-group">
        <label class="form-label">Poznámka</label>
        <textarea id="prop-notes" class="form-control" rows="2"></textarea>
      </div>
    `, {
      saveLabel: 'Přidat nemovitost',
      onSave: async () => {
        const name = document.getElementById('prop-name')?.value.trim();
        if (!name) { App.toast('Zadejte název.', 'error'); return; }
        const { error } = await db.from('rental_properties').insert({
          name,
          address: document.getElementById('prop-address')?.value.trim() || null,
          notes:   document.getElementById('prop-notes')?.value.trim() || null,
        });
        if (error) { App.toast('Chyba: ' + error.message, 'error'); return; }
        App.toast('Nemovitost přidána ✓', 'success');
        App.closeModal();
        load();
      }
    });
  }

  function openAddTenant(propertyId) {
    App.openModal('👤 Nový nájemník', `
      <div class="form-group">
        <label class="form-label">Jméno *</label>
        <input id="ten-name" class="form-control" placeholder="Jan Novák">
      </div>
      <div class="form-row">
        <div class="form-group">
          <label class="form-label">Telefon</label>
          <input id="ten-phone" class="form-control" placeholder="+420 777 000 000">
        </div>
        <div class="form-group">
          <label class="form-label">E-mail</label>
          <input id="ten-email" type="email" class="form-control" placeholder="jan@email.cz">
        </div>
      </div>
      <div class="form-row">
        <div class="form-group">
          <label class="form-label">Výše nájmu (Kč/měs.) *</label>
          <input id="ten-rent" type="number" class="form-control" placeholder="12000">
        </div>
        <div class="form-group">
          <label class="form-label">Kauce (Kč)</label>
          <input id="ten-deposit" type="number" class="form-control" placeholder="24000">
        </div>
      </div>
      <div class="form-row">
        <div class="form-group">
          <label class="form-label">Smlouva od</label>
          <input id="ten-start" type="date" class="form-control">
        </div>
        <div class="form-group">
          <label class="form-label">Smlouva do</label>
          <input id="ten-end" type="date" class="form-control">
        </div>
      </div>
      <div class="form-group">
        <label class="form-label">Poznámka</label>
        <textarea id="ten-notes" class="form-control" rows="2"></textarea>
      </div>
    `, {
      saveLabel: 'Přidat nájemníka',
      onSave: async () => {
        const name = document.getElementById('ten-name')?.value.trim();
        const rent = parseFloat(document.getElementById('ten-rent')?.value);
        if (!name || !rent) { App.toast('Vyplňte jméno a výši nájmu.', 'error'); return; }
        const { error } = await db.from('rental_tenants').insert({
          property_id:    propertyId, name,
          phone:          document.getElementById('ten-phone')?.value.trim() || null,
          email:          document.getElementById('ten-email')?.value.trim() || null,
          rent_amount:    rent,
          deposit:        parseFloat(document.getElementById('ten-deposit')?.value) || null,
          contract_start: document.getElementById('ten-start')?.value || null,
          contract_end:   document.getElementById('ten-end')?.value || null,
          notes:          document.getElementById('ten-notes')?.value.trim() || null,
          active:         true,
        });
        if (error) { App.toast('Chyba: ' + error.message, 'error'); return; }
        App.toast('Nájemník přidán ✓', 'success');
        App.closeModal();
        load();
      }
    });
  }

  async function editTenant(id) {
    const { data: t } = await db.from('rental_tenants').select('*').eq('id', id).single();
    if (!t) return;
    App.openModal('✏️ Upravit nájemníka', `
      <div class="form-group">
        <label class="form-label">Jméno *</label>
        <input id="ten-name" class="form-control" value="${App.esc(t.name)}">
      </div>
      <div class="form-row">
        <div class="form-group">
          <label class="form-label">Telefon</label>
          <input id="ten-phone" class="form-control" value="${App.esc(t.phone ?? '')}">
        </div>
        <div class="form-group">
          <label class="form-label">E-mail</label>
          <input id="ten-email" type="email" class="form-control" value="${App.esc(t.email ?? '')}">
        </div>
      </div>
      <div class="form-row">
        <div class="form-group">
          <label class="form-label">Výše nájmu (Kč)</label>
          <input id="ten-rent" type="number" class="form-control" value="${t.rent_amount ?? ''}">
        </div>
        <div class="form-group">
          <label class="form-label">Kauce (Kč)</label>
          <input id="ten-deposit" type="number" class="form-control" value="${t.deposit ?? ''}">
        </div>
      </div>
      <div class="form-row">
        <div class="form-group">
          <label class="form-label">Smlouva od</label>
          <input id="ten-start" type="date" class="form-control" value="${t.contract_start ?? ''}">
        </div>
        <div class="form-group">
          <label class="form-label">Smlouva do</label>
          <input id="ten-end" type="date" class="form-control" value="${t.contract_end ?? ''}">
        </div>
      </div>
    `, {
      saveLabel: 'Uložit',
      onSave: async () => {
        const { error } = await db.from('rental_tenants').update({
          name:           document.getElementById('ten-name')?.value.trim(),
          phone:          document.getElementById('ten-phone')?.value.trim() || null,
          email:          document.getElementById('ten-email')?.value.trim() || null,
          rent_amount:    parseFloat(document.getElementById('ten-rent')?.value) || null,
          deposit:        parseFloat(document.getElementById('ten-deposit')?.value) || null,
          contract_start: document.getElementById('ten-start')?.value || null,
          contract_end:   document.getElementById('ten-end')?.value || null,
        }).eq('id', id);
        if (error) { App.toast('Chyba: ' + error.message, 'error'); return; }
        App.toast('Uloženo ✓', 'success');
        App.closeModal();
        load();
      }
    });
  }

  function openAddRepair(propertyId) {
    App.openModal('🔧 Nová oprava', `
      <div class="form-group">
        <label class="form-label">Popis *</label>
        <input id="rep-desc" class="form-control" placeholder="např. Oprava kotle">
      </div>
      <div class="form-row">
        <div class="form-group">
          <label class="form-label">Datum</label>
          <input id="rep-date" type="date" class="form-control" value="${new Date().toISOString().split('T')[0]}">
        </div>
        <div class="form-group">
          <label class="form-label">Náklady (Kč)</label>
          <input id="rep-cost" type="number" class="form-control" placeholder="0">
        </div>
      </div>
      <div class="form-group">
        <label class="form-label">Stav</label>
        <select id="rep-status" class="form-control">
          <option value="otevřeno">Otevřeno</option>
          <option value="probíhá">Probíhá</option>
          <option value="hotovo">Hotovo</option>
        </select>
      </div>
    `, {
      saveLabel: 'Přidat opravu',
      onSave: async () => {
        const desc = document.getElementById('rep-desc')?.value.trim();
        if (!desc) { App.toast('Zadejte popis.', 'error'); return; }
        const { error } = await db.from('rental_repairs').insert({
          property_id: propertyId,
          description: desc,
          date:   document.getElementById('rep-date')?.value || null,
          cost:   parseFloat(document.getElementById('rep-cost')?.value) || null,
          status: document.getElementById('rep-status')?.value,
        });
        if (error) { App.toast('Chyba: ' + error.message, 'error'); return; }
        App.toast('Oprava přidána ✓', 'success');
        App.closeModal();
        load();
      }
    });
  }

  async function closeRepair(id) {
    await db.from('rental_repairs').update({ status: 'hotovo' }).eq('id', id);
    App.toast('Oprava uzavřena ✓', 'success');
    load();
  }

  async function deleteProperty(id) {
    if (!confirm('Smazat nemovitost i se všemi nájemníky a platbami?')) return;
    await db.from('rental_properties').delete().eq('id', id);
    App.toast('Smazáno.', '');
    load();
  }

  return { load, togglePayment, openAddTenant, editTenant, openAddRepair, closeRepair, deleteProperty, deactivateTenant, reactivateTenant };
})();

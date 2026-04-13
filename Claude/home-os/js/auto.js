/* ═══════════════════════════════════════════════
   Home OS — modul Auto
   ═══════════════════════════════════════════════ */

const Auto = (() => {
  let _bound = false;

  const SERVICE_CATS = {
    olej:       { label: 'Výměna oleje',    emoji: '🛢️' },
    pneumatiky: { label: 'Pneumatiky',      emoji: '🔄' },
    brzdy:      { label: 'Brzdy',           emoji: '🛑' },
    elektrika:  { label: 'Elektrika',       emoji: '⚡' },
    karoserie:  { label: 'Karoserie/lak',   emoji: '🔨' },
    stk:        { label: 'Příprava STK',    emoji: '🔍' },
    ostatní:    { label: 'Ostatní',         emoji: '🔧' },
  };

  const FUEL_TYPES = { benzin:'⛽ Benzin', diesel:'🛢️ Diesel', elektro:'⚡ Elektro', hybrid:'🔋 Hybrid', lpg:'🔵 LPG' };

  async function load() {
    if (!_bound) {
      document.getElementById('addCarBtn')?.addEventListener('click', openAddCar);
      _bound = true;
    }
    loadCars();
  }

  // ── Auta ─────────────────────────────────────
  async function loadCars() {
    const el = document.getElementById('cars-list');
    el.innerHTML = '<div class="loading"><div class="spinner"></div> Načítám…</div>';

    const { data: cars, error } = await db
      .from('cars')
      .select(`*, car_services(*)`)
      .order('name');

    if (error) { el.innerHTML = `<div class="empty-state"><div class="empty-text">Chyba: ${App.esc(error.message)}</div></div>`; return; }

    if (!cars.length) {
      el.innerHTML = `<div class="empty-state">
        <div class="empty-icon">🚗</div>
        <div class="empty-title">Žádná auta</div>
        <div class="empty-text">Přidejte první auto a sledujte STK, pojištění a servisy.</div>
        <button class="btn btn-primary" style="margin-top:1rem" onclick="document.getElementById('addCarBtn').click()">+ Přidat auto →</button>
      </div>`;
      return;
    }

    el.innerHTML = `<div class="grid-2" style="gap:1rem">${cars.map(car => renderCar(car)).join('')}</div>`;
  }

  function renderCar(car) {
    const stkDays = car.stk_date ? App.daysUntil(car.stk_date) : null;
    const insDays = car.insurance_date ? App.daysUntil(car.insurance_date) : null;

    const services = (car.car_services ?? [])
      .sort((a, b) => new Date(b.date) - new Date(a.date));

    let kmWarning = '';
    if (car.current_mileage && car.next_service_km) {
      const remaining = car.next_service_km - car.current_mileage;
      const cls = remaining <= 0 ? 'alert' : remaining <= 2000 ? 'warn' : 'ok';
      const txt = remaining <= 0
        ? `Servis po ${Math.abs(remaining).toLocaleString('cs-CZ')} km`
        : `Servis za ${remaining.toLocaleString('cs-CZ')} km`;
      kmWarning = `<div style="margin-top:.625rem"><span class="countdown ${cls}">🔧 ${txt}</span></div>`;
    }

    return `<div class="car-card">
      <div class="car-header">
        <div>
          <div class="car-name">🚗 ${App.esc(car.name)}</div>
          ${car.plate ? `<div class="car-plate">${App.esc(car.plate)}</div>` : ''}
          ${car.current_mileage ? `<div style="font-size:.8rem;color:var(--text-muted);margin-top:.25rem">📍 ${car.current_mileage.toLocaleString('cs-CZ')} km${car.year ? ` · 📅 ${car.year}` : ''}${car.fuel_type ? ` · ${FUEL_TYPES[car.fuel_type] ?? car.fuel_type}` : ''}</div>` : ''}
          ${car.vin ? `<div style="font-size:.72rem;color:var(--text-light);font-family:monospace;margin-top:.1rem">VIN: ${App.esc(car.vin)}</div>` : ''}
        </div>
        <div style="display:flex;gap:.375rem">
          <button class="btn btn-sm btn-outline" onclick="Auto.openAddService('${car.id}','${App.esc(car.name)}')">+ Servis</button>
          <button class="btn btn-icon btn-ghost btn-sm" onclick="Auto.editCar('${car.id}')">✏️</button>
          <button class="btn btn-icon btn-ghost btn-sm" onclick="Auto.deleteCar('${car.id}')">🗑️</button>
        </div>
      </div>

      <div class="car-dates">
        <div class="car-date-row">
          <span class="car-date-label">🔧 STK</span>
          ${stkDays !== null
            ? `<div style="display:flex;align-items:center;gap:.5rem"><span style="font-size:.875rem">${App.formatDate(car.stk_date)}</span>${App.countdownBadge(stkDays)}</div>`
            : '<span style="color:var(--text-light);font-size:.875rem">— nenastaveno</span>'}
        </div>
        <div class="car-date-row">
          <span class="car-date-label">🛡️ Pojištění</span>
          ${insDays !== null
            ? `<div style="display:flex;align-items:center;gap:.5rem"><span style="font-size:.875rem">${App.formatDate(car.insurance_date)}</span>${App.countdownBadge(insDays)}</div>`
            : '<span style="color:var(--text-light);font-size:.875rem">— nenastaveno</span>'}
        </div>
      </div>

      ${kmWarning}
      ${car.notes ? `<div style="margin-top:.75rem;font-size:.8125rem;color:var(--text-muted);padding:.5rem .75rem;background:var(--surface2);border-radius:8px">${App.esc(car.notes)}</div>` : ''}

      <div style="margin-top:.875rem">
        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:.375rem">
          <span style="font-size:.75rem;font-weight:600;color:var(--text-muted);text-transform:uppercase;letter-spacing:.04em">Historie servisu (${services.length})</span>
          ${services.length ? (() => {
            const totalCost = services.reduce((s, r) => s + (parseFloat(r.cost) || 0), 0);
            return totalCost ? `<span style="font-size:.78rem;color:var(--text-muted)">Celkem: <strong style="color:var(--text)">${App.formatMoney(totalCost)}</strong></span>` : '';
          })() : ''}
        </div>
        ${services.length ? `
        <div style="max-height:220px;overflow-y:auto;border:1px solid var(--border);border-radius:8px">
          ${services.map((s, i) => `
          <div style="display:flex;justify-content:space-between;align-items:center;padding:.375rem .625rem;${i < services.length - 1 ? 'border-bottom:1px solid var(--border);' : ''}font-size:.875rem">
            <div style="min-width:0;flex:1">
              <span style="font-weight:500">${SERVICE_CATS[s.category]?.emoji ?? '🔧'} ${App.esc(s.description || (SERVICE_CATS[s.category]?.label ?? 'Servis'))}</span>
              <span style="color:var(--text-muted);margin-left:.5rem;font-size:.8rem">${App.formatDate(s.date)}${s.mileage ? ` · ${s.mileage.toLocaleString('cs-CZ')} km` : ''}</span>
            </div>
            <div style="display:flex;align-items:center;gap:.5rem;flex-shrink:0">
              ${s.cost ? `<span style="font-weight:600;font-size:.85rem">${App.formatMoney(s.cost)}</span>` : ''}
              <button class="btn btn-icon btn-ghost btn-sm" title="Přílohy" onclick="Docs.open('car_service','${s.id}','${App.esc(s.description || (SERVICE_CATS[s.category]?.label ?? 'Servis'))}')">📎</button>
              <button class="btn btn-icon btn-ghost btn-sm" onclick="Auto.deleteService('${s.id}')">🗑️</button>
            </div>
          </div>`).join('')}
        </div>` : `<div style="color:var(--text-muted);font-size:.8125rem;padding:.375rem .625rem;border:1px solid var(--border);border-radius:8px">Zatím žádné záznamy. <button class="btn btn-sm btn-outline" style="margin-left:.5rem" onclick="Auto.openAddService('${car.id}','${App.esc(car.name)}')">+ Přidat →</button></div>`}
      </div>
    </div>`;
  }

  function openAddCar() {
    App.openModal('🚗 Nové auto', `
      <div class="form-group">
        <label class="form-label">Název *</label>
        <input id="car-name" class="form-control" placeholder="např. Škoda Octavia">
      </div>
      <div class="form-row">
        <div class="form-group">
          <label class="form-label">SPZ</label>
          <input id="car-plate" class="form-control" placeholder="1AB 2345">
        </div>
        <div class="form-group"><!-- spacer --></div>
      </div>
      <div class="form-row">
        <div class="form-group">
          <label class="form-label">Rok výroby</label>
          <input id="car-year" type="number" class="form-control" placeholder="2020" min="1950" max="2030">
        </div>
        <div class="form-group">
          <label class="form-label">Typ paliva</label>
          <select id="car-fuel" class="form-control">
            <option value="">—</option>
            <option value="benzin">⛽ Benzin</option>
            <option value="diesel">🛢️ Diesel</option>
            <option value="elektro">⚡ Elektro</option>
            <option value="hybrid">🔋 Hybrid</option>
            <option value="lpg">🔵 LPG</option>
          </select>
        </div>
      </div>
      <div class="form-group">
        <label class="form-label">VIN</label>
        <input id="car-vin" class="form-control" placeholder="WBA1234…">
      </div>
      <div class="form-row">
        <div class="form-group">
          <label class="form-label">STK do</label>
          <input id="car-stk" type="date" class="form-control">
        </div>
        <div class="form-group">
          <label class="form-label">Pojištění do</label>
          <input id="car-ins" type="date" class="form-control">
        </div>
      </div>
      <div class="form-row">
        <div class="form-group">
          <label class="form-label">Aktuální km</label>
          <input id="car-km" type="number" class="form-control" placeholder="85000">
        </div>
        <div class="form-group">
          <label class="form-label">Příští servis (km)</label>
          <input id="car-next-km" type="number" class="form-control" placeholder="90000">
        </div>
      </div>
      <div class="form-group">
        <label class="form-label">Poznámka</label>
        <textarea id="car-notes" class="form-control" rows="2"></textarea>
      </div>
    `, {
      saveLabel: 'Přidat auto',
      onSave: async () => {
        const name = document.getElementById('car-name')?.value.trim();
        if (!name) { App.toast('Zadejte název.', 'error'); return; }
        const { error } = await db.from('cars').insert({
          name,
          plate:           document.getElementById('car-plate')?.value.trim() || null,
          stk_date:        document.getElementById('car-stk')?.value || null,
          insurance_date:  document.getElementById('car-ins')?.value || null,
          current_mileage: parseInt(document.getElementById('car-km')?.value) || null,
          next_service_km: parseInt(document.getElementById('car-next-km')?.value) || null,
          notes:           document.getElementById('car-notes')?.value.trim() || null,
          year:            parseInt(document.getElementById('car-year')?.value) || null,
          fuel_type:       document.getElementById('car-fuel')?.value || null,
          vin:             document.getElementById('car-vin')?.value.trim() || null,
        });
        if (error) { App.toast('Chyba: ' + error.message, 'error'); return; }
        App.toast('Auto přidáno ✓', 'success');
        App.closeModal();
        loadCars();
      }
    });
  }

  async function editCar(id) {
    const { data: car } = await db.from('cars').select('*').eq('id', id).single();
    if (!car) return;
    App.openModal('✏️ Upravit auto', `
      <div class="form-group">
        <label class="form-label">Název *</label>
        <input id="car-name" class="form-control" value="${App.esc(car.name)}">
      </div>
      <div class="form-row">
        <div class="form-group">
          <label class="form-label">SPZ</label>
          <input id="car-plate" class="form-control" value="${App.esc(car.plate ?? '')}">
        </div>
        <div class="form-group"><!-- spacer --></div>
      </div>
      <div class="form-row">
        <div class="form-group">
          <label class="form-label">Rok výroby</label>
          <input id="car-year" type="number" class="form-control" value="${car.year ?? ''}" min="1950" max="2030">
        </div>
        <div class="form-group">
          <label class="form-label">Typ paliva</label>
          <select id="car-fuel" class="form-control">
            <option value="">—</option>
            <option value="benzin" ${car.fuel_type==='benzin'?'selected':''}>⛽ Benzin</option>
            <option value="diesel" ${car.fuel_type==='diesel'?'selected':''}>🛢️ Diesel</option>
            <option value="elektro" ${car.fuel_type==='elektro'?'selected':''}>⚡ Elektro</option>
            <option value="hybrid" ${car.fuel_type==='hybrid'?'selected':''}>🔋 Hybrid</option>
            <option value="lpg" ${car.fuel_type==='lpg'?'selected':''}>🔵 LPG</option>
          </select>
        </div>
      </div>
      <div class="form-group">
        <label class="form-label">VIN</label>
        <input id="car-vin" class="form-control" value="${App.esc(car.vin ?? '')}">
      </div>
      <div class="form-row">
        <div class="form-group">
          <label class="form-label">STK do</label>
          <input id="car-stk" type="date" class="form-control" value="${car.stk_date ?? ''}">
        </div>
        <div class="form-group">
          <label class="form-label">Pojištění do</label>
          <input id="car-ins" type="date" class="form-control" value="${car.insurance_date ?? ''}">
        </div>
      </div>
      <div class="form-row">
        <div class="form-group">
          <label class="form-label">Aktuální km</label>
          <input id="car-km" type="number" class="form-control" value="${car.current_mileage ?? ''}">
        </div>
        <div class="form-group">
          <label class="form-label">Příští servis (km)</label>
          <input id="car-next-km" type="number" class="form-control" value="${car.next_service_km ?? ''}">
        </div>
      </div>
      <div class="form-group">
        <label class="form-label">Poznámka</label>
        <textarea id="car-notes" class="form-control" rows="2">${App.esc(car.notes ?? '')}</textarea>
      </div>
    `, {
      saveLabel: 'Uložit',
      onSave: async () => {
        const name = document.getElementById('car-name')?.value.trim();
        if (!name) { App.toast('Zadejte název.', 'error'); return; }
        const { error } = await db.from('cars').update({
          name,
          plate:           document.getElementById('car-plate')?.value.trim() || null,
          stk_date:        document.getElementById('car-stk')?.value || null,
          insurance_date:  document.getElementById('car-ins')?.value || null,
          current_mileage: parseInt(document.getElementById('car-km')?.value) || null,
          next_service_km: parseInt(document.getElementById('car-next-km')?.value) || null,
          notes:           document.getElementById('car-notes')?.value.trim() || null,
          year:            parseInt(document.getElementById('car-year')?.value) || null,
          fuel_type:       document.getElementById('car-fuel')?.value || null,
          vin:             document.getElementById('car-vin')?.value.trim() || null,
        }).eq('id', id);
        if (error) { App.toast('Chyba: ' + error.message, 'error'); return; }
        App.toast('Uloženo ✓', 'success');
        App.closeModal();
        loadCars();
      }
    });
  }

  async function deleteCar(id) {
    if (!confirm('Smazat auto i s historií servisů?')) return;
    await db.from('cars').delete().eq('id', id);
    App.toast('Smazáno.', '');
    loadCars();
  }

  function openAddService(carId, carName) {
    App.openModal(`🔧 Nový servis — ${carName}`, `
      <div class="form-row">
        <div class="form-group">
          <label class="form-label">Kategorie *</label>
          <select id="svc-cat" class="form-control">
            <option value="olej">🛢️ Výměna oleje</option>
            <option value="pneumatiky">🔄 Pneumatiky</option>
            <option value="brzdy">🛑 Brzdy</option>
            <option value="elektrika">⚡ Elektrika</option>
            <option value="karoserie">🔨 Karoserie/lak</option>
            <option value="stk">🔍 Příprava STK</option>
            <option value="ostatní" selected>🔧 Ostatní</option>
          </select>
        </div>
        <div class="form-group">
          <label class="form-label">Popis</label>
          <input id="svc-desc" class="form-control" placeholder="podrobnosti…">
        </div>
      </div>
      <div class="form-row">
        <div class="form-group">
          <label class="form-label">Datum *</label>
          <input id="svc-date" type="date" class="form-control" value="${new Date().toISOString().split('T')[0]}">
        </div>
        <div class="form-group">
          <label class="form-label">Stav km</label>
          <input id="svc-km" type="number" class="form-control" placeholder="85000">
        </div>
      </div>
      <div class="form-row">
        <div class="form-group">
          <label class="form-label">Náklady (Kč)</label>
          <input id="svc-cost" type="number" class="form-control" placeholder="0">
        </div>
        <div class="form-group">
          <label class="form-label">Příští servis za (km)</label>
          <input id="svc-next" type="number" class="form-control" placeholder="15000">
        </div>
      </div>
      <div class="form-group">
        <label class="form-label">Poznámka</label>
        <input id="svc-notes" class="form-control">
      </div>
    `, {
      saveLabel: 'Přidat servis',
      onSave: async () => {
        const date = document.getElementById('svc-date')?.value;
        const km   = parseInt(document.getElementById('svc-km')?.value) || null;
        const next = parseInt(document.getElementById('svc-next')?.value) || null;
        if (!date) { App.toast('Vyplňte datum.', 'error'); return; }
        const { error } = await db.from('car_services').insert({
          car_id: carId, category: document.getElementById('svc-cat')?.value || 'ostatní', description: document.getElementById('svc-desc')?.value.trim() || null, date, mileage: km,
          cost:  parseFloat(document.getElementById('svc-cost')?.value) || null,
          notes: document.getElementById('svc-notes')?.value.trim() || null,
        });
        if (error) { App.toast('Chyba: ' + error.message, 'error'); return; }
        const updates = {};
        if (km) updates.current_mileage = km;
        if (km && next) updates.next_service_km = km + next;
        if (Object.keys(updates).length) await db.from('cars').update(updates).eq('id', carId);
        App.toast('Servis přidán ✓', 'success');
        App.closeModal();
        loadCars();
      }
    });
  }

  async function deleteService(id) {
    if (!confirm('Smazat servisní záznam?')) return;
    await db.from('car_services').delete().eq('id', id);
    App.toast('Smazáno.', '');
    loadCars();
  }

  // ── Palivo ───────────────────────────────────
  async function loadFuel() {
    const el = document.getElementById('fuel-list');
    if (!el) return;
    el.innerHTML = '<div class="loading"><div class="spinner"></div> Načítám…</div>';

    const { data: logs, error } = await db
      .from('car_fuel_logs')
      .select('*, cars(name)')
      .order('date', { ascending: false })
      .limit(50);

    if (error) { el.innerHTML = `<div class="empty-state"><div class="empty-text">Chyba: ${App.esc(error.message)}</div></div>`; return; }

    if (!logs?.length) {
      el.innerHTML = `<div class="empty-state">
        <div class="empty-icon">⛽</div>
        <div class="empty-title">Žádné záznamy o palivu</div>
        <div class="empty-text">Zaznamenejte tankování a sledujte průměrnou spotřebu.</div>
        <button class="btn btn-primary" style="margin-top:1rem" onclick="Auto.openAddFuel()">+ Přidat tankování →</button>
      </div>`;
      return;
    }

    const totalLiters = logs.reduce((s, l) => s + (parseFloat(l.liters) || 0), 0);
    const totalCost   = logs.reduce((s, l) => s + (parseFloat(l.price_total) || 0), 0);
    const avgPrice    = totalLiters > 0 ? totalCost / totalLiters : 0;

    const withKm = [...logs].filter(l => l.mileage).sort((a, b) => a.mileage - b.mileage);
    let avgConsumption = '';
    if (withKm.length >= 2) {
      const kmDiff  = withKm[withKm.length-1].mileage - withKm[0].mileage;
      const litSum  = withKm.reduce((s, l) => s + (parseFloat(l.liters) || 0), 0);
      if (kmDiff > 0) avgConsumption = (litSum / kmDiff * 100).toFixed(1) + ' l/100 km';
    }

    el.innerHTML = `
      <div style="display:flex;gap:.75rem;margin-bottom:1rem;flex-wrap:wrap">
        <div class="kpi-card" style="flex:1;min-width:100px;padding:.75rem">
          <div class="kpi-label">Celkem litrů</div>
          <div style="font-size:1.125rem;font-weight:700">${totalLiters.toFixed(1)} l</div>
        </div>
        <div class="kpi-card" style="flex:1;min-width:100px;padding:.75rem">
          <div class="kpi-label">Celkové náklady</div>
          <div style="font-size:1.125rem;font-weight:700;color:var(--danger)">${App.formatMoney(totalCost)}</div>
        </div>
        <div class="kpi-card" style="flex:1;min-width:100px;padding:.75rem">
          <div class="kpi-label">Průměr Kč/l</div>
          <div style="font-size:1.125rem;font-weight:700">${avgPrice > 0 ? avgPrice.toFixed(1) : '—'}</div>
        </div>
        ${avgConsumption ? `<div class="kpi-card" style="flex:1;min-width:100px;padding:.75rem">
          <div class="kpi-label">Průměrná spotřeba</div>
          <div style="font-size:1.125rem;font-weight:700">${avgConsumption}</div>
        </div>` : ''}
      </div>
      <div style="display:flex;flex-direction:column;gap:.375rem">
        ${logs.map(l => `<div class="tx-item">
          <div style="font-size:1.25rem">⛽</div>
          <div class="tx-body">
            <div class="tx-desc">${App.esc(l.cars?.name ?? '—')}${l.liters ? ` · ${parseFloat(l.liters).toFixed(1)} l` : ''}${l.mileage ? ` · ${l.mileage.toLocaleString('cs-CZ')} km` : ''}</div>
            <div class="tx-meta">${App.formatDate(l.date)}${l.notes ? ' · ' + App.esc(l.notes) : ''}</div>
          </div>
          ${l.price_total ? `<div class="tx-amount expense">−${App.formatMoney(l.price_total)}</div>` : ''}
          <div class="tx-actions">
            <button class="btn btn-icon btn-ghost btn-sm" onclick="Auto.deleteFuel('${l.id}')">🗑️</button>
          </div>
        </div>`).join('')}
      </div>`;
  }

  async function openAddFuel() {
    const { data: cars } = await db.from('cars').select('id,name').order('name');
    App.openModal('⛽ Tankování', `
      <div class="form-group">
        <label class="form-label">Auto *</label>
        <select id="fuel-car" class="form-control">
          ${(cars ?? []).map(c => `<option value="${c.id}">${App.esc(c.name)}</option>`).join('')}
        </select>
      </div>
      <div class="form-row">
        <div class="form-group">
          <label class="form-label">Datum *</label>
          <input id="fuel-date" type="date" class="form-control" value="${new Date().toISOString().split('T')[0]}">
        </div>
        <div class="form-group">
          <label class="form-label">Litry</label>
          <input id="fuel-liters" type="number" class="form-control" placeholder="45.5" step="0.1">
        </div>
      </div>
      <div class="form-row">
        <div class="form-group">
          <label class="form-label">Celková cena (Kč)</label>
          <input id="fuel-price" type="number" class="form-control" placeholder="1800">
        </div>
        <div class="form-group">
          <label class="form-label">Stav km</label>
          <input id="fuel-km" type="number" class="form-control" placeholder="85000">
        </div>
      </div>
      <div class="form-group">
        <label class="form-label">Poznámka</label>
        <input id="fuel-notes" class="form-control" placeholder="Natural 95, Shell…">
      </div>
    `, {
      saveLabel: 'Přidat',
      onSave: async () => {
        const carId = document.getElementById('fuel-car')?.value;
        const date  = document.getElementById('fuel-date')?.value;
        if (!carId || !date) { App.toast('Vyberte auto a datum.', 'error'); return; }
        const km = parseInt(document.getElementById('fuel-km')?.value) || null;
        const { error } = await db.from('car_fuel_logs').insert({
          car_id:      carId, date,
          liters:      parseFloat(document.getElementById('fuel-liters')?.value) || null,
          price_total: parseFloat(document.getElementById('fuel-price')?.value) || null,
          mileage:     km,
          notes:       document.getElementById('fuel-notes')?.value.trim() || null,
        });
        if (error) { App.toast('Chyba: ' + error.message, 'error'); return; }
        if (km) await db.from('cars').update({ current_mileage: km }).eq('id', carId);
        App.toast('Tankování přidáno ✓', 'success');
        App.closeModal();
        loadFuel();
      }
    });
  }

  async function deleteFuel(id) {
    if (!confirm('Smazat záznam o tankování?')) return;
    await db.from('car_fuel_logs').delete().eq('id', id);
    App.toast('Smazáno.', '');
    loadFuel();
  }

  return { load, editCar, deleteCar, openAddService, deleteService, openAddFuel, deleteFuel };
})();

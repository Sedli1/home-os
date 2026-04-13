/* ═══════════════════════════════════════════════
   Home OS — modul Zdraví
   ═══════════════════════════════════════════════ */

const Zdravi = (() => {
  let members = [];
  let _bound  = false;

  const TYPES = {
    prohlídka:  { label: 'Prohlídka',    emoji: '🩺', color: '#3b82f6' },
    očkování:   { label: 'Očkování',     emoji: '💉', color: '#10b981' },
    lék:        { label: 'Lék/recept',   emoji: '💊', color: '#8b5cf6' },
    diagnóza:   { label: 'Diagnóza',     emoji: '📋', color: '#f59e0b' },
    zubař:      { label: 'Zubař',        emoji: '🦷', color: '#ec4899' },
    jiné:       { label: 'Jiné',         emoji: '❤️', color: '#94a3b8' },
  };

  async function load() {
    const { data } = await db.from('family_members').select('*').order('name');
    members = data ?? [];

    if (!_bound) {
      document.getElementById('addHealthBtn')?.addEventListener('click', openAddRecord);
      _bound = true;
    }
    loadOverview();
    loadUpcoming();
    loadRecords();
  }

  // ── Přehled ──────────────────────────────────
  async function loadOverview() {
    const el = document.getElementById('zdravi-overview');
    if (!el) return;
    el.innerHTML = '<div class="loading"><div class="spinner"></div> Načítám…</div>';

    if (!members.length) {
      el.innerHTML = `<div class="empty-state">
        <div class="empty-icon">👨‍👩‍👧‍👦</div>
        <div class="empty-title">Nejdříve přidejte členy rodiny</div>
        <button class="btn btn-outline" style="margin-top:1rem" onclick="App.navigateTo('rodina')">→ Rodina</button>
      </div>`;
      return;
    }

    const { data: records } = await db.from('health_records').select('*').order('date', { ascending: false });
    const recByMember = {};
    (records ?? []).forEach(r => {
      if (!recByMember[r.member_id]) recByMember[r.member_id] = [];
      recByMember[r.member_id].push(r);
    });

    el.innerHTML = `<div class="grid-2" style="gap:1rem">
      ${members.map(m => {
        const recs = recByMember[m.id] ?? [];
        const upcoming = recs.filter(r => r.next_date && r.next_date >= new Date().toISOString().split('T')[0])
          .sort((a, b) => a.next_date.localeCompare(b.next_date));
        const last = recs[0];
        return `<div class="card" style="cursor:pointer" onclick="Zdravi.filterByMember('${m.id}')">
          <div class="card-body">
            <div style="display:flex;align-items:center;gap:.875rem;margin-bottom:.875rem">
              <div style="width:42px;height:42px;border-radius:50%;background:${m.color??'#6366f1'};display:flex;align-items:center;justify-content:center;color:#fff;font-weight:700;font-size:1.1rem;flex-shrink:0">${App.esc(m.name[0])}</div>
              <div>
                <div style="font-weight:700">${App.esc(m.name)}</div>
                <div style="font-size:.8rem;color:var(--text-muted)">${recs.length} záznamů</div>
              </div>
            </div>
            ${upcoming.length ? `<div style="margin-bottom:.5rem">
              <div style="font-size:.75rem;font-weight:600;color:var(--text-muted);text-transform:uppercase;letter-spacing:.04em;margin-bottom:.25rem">Příští termín</div>
              ${upcoming.slice(0,2).map(r => {
                const t = TYPES[r.type] ?? TYPES.jiné;
                const days = App.daysUntil(r.next_date);
                return `<div style="display:flex;justify-content:space-between;align-items:center;font-size:.875rem;padding:.25rem 0">
                  <span>${t.emoji} ${App.esc(r.title)}</span>
                  ${App.countdownBadge(days)}
                </div>`;
              }).join('')}
            </div>` : ''}
            ${last ? `<div style="font-size:.78rem;color:var(--text-muted)">Poslední: ${App.esc(last.title)} · ${last.date ? App.formatDate(last.date) : '—'}</div>` : ''}
            <button class="btn btn-sm btn-outline" style="margin-top:.75rem;width:100%" onclick="event.stopPropagation();Zdravi.openAddRecord('${m.id}')">+ Přidat záznam</button>
          </div>
        </div>`;
      }).join('')}
    </div>`;
  }

  // ── Záznamy ──────────────────────────────────
  let filterMemberId = '';
  let filterTypeId   = '';

  async function loadRecords(memberId, typeId) {
    if (memberId !== undefined) filterMemberId = memberId;
    if (typeId   !== undefined) filterTypeId   = typeId;
    const el = document.getElementById('zdravi-records');
    if (!el) return;
    el.innerHTML = '<div class="loading"><div class="spinner"></div> Načítám…</div>';

    let query = db.from('health_records').select('*, family_members(name,color)').order('date', { ascending: false });
    if (filterMemberId) query = query.eq('member_id', filterMemberId);
    if (filterTypeId)   query = query.eq('type', filterTypeId);

    const { data, error } = await query.limit(100);
    if (error) { el.innerHTML = `<div class="empty-state"><div class="empty-text">Chyba: ${App.esc(error.message)}</div></div>`; return; }

    // Member filter buttons
    const filterHtml = `
    <div style="display:flex;gap:.375rem;flex-wrap:wrap;margin-bottom:.5rem">
      <button class="btn btn-sm ${!filterMemberId ? 'btn-primary' : 'btn-outline'}" onclick="Zdravi.filterByMember('')">Všichni</button>
      ${members.map(m => `<button class="btn btn-sm ${filterMemberId===m.id ? 'btn-primary' : 'btn-outline'}" onclick="Zdravi.filterByMember('${m.id}')">${App.esc(m.name)}</button>`).join('')}
    </div>
    <div style="display:flex;gap:.375rem;flex-wrap:wrap;margin-bottom:1rem">
      <button class="btn btn-sm ${!filterTypeId ? 'btn-primary' : 'btn-outline'}" onclick="Zdravi.filterByType('')">Vše</button>
      ${Object.entries(TYPES).map(([k,v]) => `<button class="btn btn-sm ${filterTypeId===k ? 'btn-primary' : 'btn-outline'}" onclick="Zdravi.filterByType('${k}')">${v.emoji} ${v.label}</button>`).join('')}
    </div>`;

    if (!data?.length) {
      el.innerHTML = filterHtml + `<div class="empty-state">
        <div class="empty-icon">🏥</div>
        <div class="empty-title">Žádné zdravotní záznamy</div>
        <button class="btn btn-primary" style="margin-top:1rem" onclick="Zdravi.openAddRecord()">+ Přidat záznam →</button>
      </div>`;
      return;
    }

    el.innerHTML = filterHtml + data.map(r => {
      const t = TYPES[r.type] ?? TYPES.jiné;
      const m = r.family_members;
      return `<div class="event-item" style="background:var(--surface2)">
        <div class="event-date-box" style="background:${t.color}18;color:${t.color}">
          <span style="font-size:1.25rem">${t.emoji}</span>
        </div>
        <div class="event-body">
          <div class="event-title">${App.esc(r.title)}</div>
          <div class="event-meta">
            ${t.label}
            ${m ? ` · <span style="color:${m.color??'#6366f1'}">${App.esc(m.name)}</span>` : ''}
            ${r.doctor ? ` · 👨‍⚕️ ${App.esc(r.doctor)}` : ''}
            ${r.date ? ` · ${App.formatDate(r.date)}` : ''}
          </div>
          ${r.dosage ? `<div style="font-size:.78rem;color:var(--text-muted);margin-top:.2rem">💊 ${App.esc(r.dosage)}${r.frequency ? ' · ' + App.esc(r.frequency) : ''}</div>` : ''}
          ${r.batch_number ? `<div style="font-size:.78rem;color:var(--text-muted);margin-top:.2rem">🔬 Šarže: ${App.esc(r.batch_number)}</div>` : ''}
          ${r.notes ? `<div style="font-size:.78rem;color:var(--text-muted);margin-top:.25rem">${App.esc(r.notes)}</div>` : ''}
          ${r.next_date ? `<div style="font-size:.78rem;margin-top:.25rem;display:flex;align-items:center;gap:.375rem;flex-wrap:wrap">📅 Příští termín: <strong>${App.formatDate(r.next_date)}</strong> ${App.countdownBadge(App.daysUntil(r.next_date))} <button class="btn btn-sm btn-outline" style="font-size:.72rem;padding:.1rem .4rem" onclick="Zdravi.addToCalendar('${r.id}')">📅 Do kalendáře</button></div>` : ''}
        </div>
        <div class="event-actions">
          <button class="btn btn-icon btn-ghost btn-sm" title="Přílohy" onclick="Docs.open('health','${r.id}','${App.esc(r.title)}')">📎</button>
          <button class="btn btn-icon btn-ghost btn-sm" onclick="Zdravi.editRecord('${r.id}')">✏️</button>
          <button class="btn btn-icon btn-ghost btn-sm" onclick="Zdravi.deleteRecord('${r.id}')">🗑️</button>
        </div>
      </div>`;
    }).join('');
  }

  function filterByType(type) {
    filterTypeId = type;
    loadRecords(undefined, type);
    document.getElementById('zdravi-records')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  function filterByMember(id) {
    filterMemberId = id;
    loadRecords(id);
    // Scroll to records section
    document.getElementById('zdravi-records')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  // ── Termíny ──────────────────────────────────
  async function loadUpcoming() {
    const el = document.getElementById('zdravi-terminy');
    if (!el) return;
    el.innerHTML = '<div class="loading"><div class="spinner"></div> Načítám…</div>';

    const today = new Date().toISOString().split('T')[0];
    const { data, error } = await db
      .from('health_records')
      .select('*, family_members(name,color)')
      .not('next_date', 'is', null)
      .gte('next_date', today)
      .order('next_date')
      .limit(20);

    if (error) { el.innerHTML = `<div class="empty-state"><div class="empty-text">Chyba</div></div>`; return; }

    if (!data?.length) {
      el.innerHTML = `<div class="empty-state">
        <div class="empty-icon">📅</div>
        <div class="empty-title">Žádné nadcházející termíny</div>
        <div class="empty-text">Přidejte záznamy s termínem příštího vyšetření.</div>
      </div>`;
      return;
    }

    el.innerHTML = data.map(r => {
      const t = TYPES[r.type] ?? TYPES.jiné;
      const m = r.family_members;
      const days = App.daysUntil(r.next_date);
      const d = new Date(r.next_date + 'T00:00:00');
      return `<div class="event-item" style="align-items:flex-start">
        <div class="event-date-box" style="background:${t.color}18;color:${t.color}">
          <span class="day">${d.getDate()}</span>
          <span class="mon">${d.toLocaleDateString('cs-CZ',{month:'short'})}</span>
        </div>
        <div class="event-body">
          <div class="event-title">${t.emoji} ${App.esc(r.title)}</div>
          <div class="event-meta">
            ${m ? `<span style="color:${m.color??'#6366f1'}">${App.esc(m.name)}</span> · ` : ''}
            ${t.label}${r.doctor ? ` · 👨‍⚕️ ${App.esc(r.doctor)}` : ''}
          </div>
          <div style="margin-top:.375rem;display:flex;align-items:center;gap:.5rem;flex-wrap:wrap">
            ${App.countdownBadge(days)}
            <button class="btn btn-sm btn-outline" style="font-size:.75rem;padding:.2rem .5rem" onclick="Zdravi.addToCalendar('${r.id}')">📅 Do kalendáře</button>
          </div>
        </div>
      </div>`;
    }).join('');
  }

  async function addToCalendar(id) {
    const { data: r } = await db.from('health_records').select('*, family_members(name)').eq('id', id).single();
    if (!r?.next_date) { App.toast('Záznam nemá datum termínu.', 'error'); return; }
    const title = `${TYPES[r.type]?.emoji ?? '🏥'} ${r.title}${r.family_members ? ' — ' + r.family_members.name : ''}`;
    const { error } = await db.from('family_events').insert({
      title,
      date:      r.next_date,
      type:      'lékař',
      notes:     r.notes ?? '',
      member_id: r.member_id ?? null,
      recurring: false,
    });
    if (error) { App.toast('Chyba: ' + error.message, 'error'); return; }
    App.toast('Přidáno do kalendáře ✓', 'success');
  }

  // ── Type-specific extra fields ───────────────
  function extraFieldsHtml(type, prefill = {}) {
    if (type === 'lék') return `
      <div class="form-row">
        <div class="form-group">
          <label class="form-label">Dávkování</label>
          <input id="hr-dosage" class="form-control" placeholder="1 tableta, 5 mg…" value="${App.esc(prefill.dosage ?? '')}">
        </div>
        <div class="form-group">
          <label class="form-label">Frekvence</label>
          <input id="hr-frequency" class="form-control" placeholder="ráno+večer, 3× denně…" value="${App.esc(prefill.frequency ?? '')}">
        </div>
      </div>`;
    if (type === 'očkování') return `
      <div class="form-group">
        <label class="form-label">Číslo šarže vakcíny</label>
        <input id="hr-batch" class="form-control" placeholder="AB12345…" value="${App.esc(prefill.batch_number ?? '')}">
      </div>`;
    if (type === 'prohlídka' || type === 'zubař') return `
      <div class="form-group">
        <label class="form-label">Opakovat každých (měsíců)</label>
        <input id="hr-interval" type="number" class="form-control" placeholder="12" value="${prefill.interval_months ?? ''}" min="1" max="120">
      </div>`;
    return '';
  }

  function onTypeChange(val) {
    const el = document.getElementById('hr-extra');
    if (el) el.innerHTML = extraFieldsHtml(val);
  }

  function collectExtra() {
    return {
      dosage:         document.getElementById('hr-dosage')?.value.trim() || null,
      frequency:      document.getElementById('hr-frequency')?.value.trim() || null,
      batch_number:   document.getElementById('hr-batch')?.value.trim() || null,
      interval_months: parseInt(document.getElementById('hr-interval')?.value) || null,
    };
  }

  // ── CRUD ─────────────────────────────────────
  function openAddRecord(preselectedMemberId) {
    const memberOptions = members.map(m =>
      `<option value="${m.id}" ${m.id === preselectedMemberId ? 'selected' : ''}>${App.esc(m.name)}</option>`
    ).join('');

    const initType = 'prohlídka';
    App.openModal('🏥 Nový zdravotní záznam', `
      <div class="form-group">
        <label class="form-label">Název *</label>
        <input id="hr-title" class="form-control" placeholder="např. Preventivní prohlídka, Očkování Kubík">
      </div>
      <div class="form-row">
        <div class="form-group">
          <label class="form-label">Typ *</label>
          <select id="hr-type" class="form-control" onchange="Zdravi.onTypeChange(this.value)">
            ${Object.entries(TYPES).map(([k,v]) => `<option value="${k}">${v.emoji} ${v.label}</option>`).join('')}
          </select>
        </div>
        ${memberOptions ? `<div class="form-group">
          <label class="form-label">Člen rodiny</label>
          <select id="hr-member" class="form-control">
            <option value="">— nikdo —</option>
            ${memberOptions}
          </select>
        </div>` : '<div class="form-group"></div>'}
      </div>
      <div id="hr-extra">${extraFieldsHtml(initType)}</div>
      <div class="form-row">
        <div class="form-group">
          <label class="form-label">Datum návštěvy</label>
          <input id="hr-date" type="date" class="form-control">
        </div>
        <div class="form-group">
          <label class="form-label">Příští termín</label>
          <input id="hr-next" type="date" class="form-control">
        </div>
      </div>
      <div class="form-group">
        <label class="form-label">Lékař / nemocnice</label>
        <input id="hr-doctor" class="form-control" placeholder="MUDr. Novák, Nemocnice Plzeň…">
      </div>
      <div class="form-group">
        <label class="form-label">Poznámka</label>
        <textarea id="hr-notes" class="form-control" rows="2" placeholder="výsledky, doporučení, léky…"></textarea>
      </div>
      <div class="form-group" style="border-top:1px solid var(--border);padding-top:.875rem;margin-top:.25rem">
        <label class="form-label" style="margin-bottom:.5rem">📎 Přílohy (PDF, obrázky)</label>
        <input type="file" id="hr-files" multiple accept=".pdf,.png,.jpg,.jpeg,.webp,.doc,.docx" class="form-control" style="padding:.375rem;font-size:.875rem">
        <div style="font-size:.75rem;color:var(--text-muted);margin-top:.25rem">Soubory se nahrají po uložení záznamu. Max 10 MB / soubor.</div>
      </div>
    `, {
      saveLabel: 'Přidat záznam',
      onSave: async () => {
        const title = document.getElementById('hr-title')?.value.trim();
        if (!title) { App.toast('Zadejte název.', 'error'); return; }
        const { data: newRec, error } = await db.from('health_records').insert({
          title,
          type:      document.getElementById('hr-type')?.value ?? 'jiné',
          member_id: document.getElementById('hr-member')?.value || null,
          date:      document.getElementById('hr-date')?.value || null,
          next_date: document.getElementById('hr-next')?.value || null,
          doctor:    document.getElementById('hr-doctor')?.value.trim() || null,
          notes:     document.getElementById('hr-notes')?.value.trim() || null,
          ...collectExtra(),
        }).select('id').single();
        if (error) { App.toast('Chyba: ' + error.message, 'error'); return; }
        const files = document.getElementById('hr-files')?.files;
        if (files?.length) await Docs.uploadFiles('health', newRec.id, files);
        App.toast('Záznam přidán ✓', 'success');
        App.closeModal();
        loadTab(activeTab);
      }
    });
  }

  async function editRecord(id) {
    const { data: r } = await db.from('health_records').select('*').eq('id', id).single();
    if (!r) return;
    const memberOptions = members.map(m =>
      `<option value="${m.id}" ${m.id === r.member_id ? 'selected' : ''}>${App.esc(m.name)}</option>`
    ).join('');
    App.openModal('✏️ Upravit záznam', `
      <div class="form-group">
        <label class="form-label">Název *</label>
        <input id="hr-title" class="form-control" value="${App.esc(r.title)}">
      </div>
      <div class="form-row">
        <div class="form-group">
          <label class="form-label">Typ</label>
          <select id="hr-type" class="form-control" onchange="Zdravi.onTypeChange(this.value)">
            ${Object.entries(TYPES).map(([k,v]) => `<option value="${k}" ${r.type===k?'selected':''}>${v.emoji} ${v.label}</option>`).join('')}
          </select>
        </div>
        <div class="form-group">
          <label class="form-label">Člen rodiny</label>
          <select id="hr-member" class="form-control">
            <option value="">— nikdo —</option>
            ${memberOptions}
          </select>
        </div>
      </div>
      <div id="hr-extra">${extraFieldsHtml(r.type, r)}</div>
      <div class="form-row">
        <div class="form-group">
          <label class="form-label">Datum</label>
          <input id="hr-date" type="date" class="form-control" value="${r.date ?? ''}">
        </div>
        <div class="form-group">
          <label class="form-label">Příští termín</label>
          <input id="hr-next" type="date" class="form-control" value="${r.next_date ?? ''}">
        </div>
      </div>
      <div class="form-group">
        <label class="form-label">Lékař</label>
        <input id="hr-doctor" class="form-control" value="${App.esc(r.doctor ?? '')}">
      </div>
      <div class="form-group">
        <label class="form-label">Poznámka</label>
        <textarea id="hr-notes" class="form-control" rows="2">${App.esc(r.notes ?? '')}</textarea>
      </div>
      <div class="form-group" style="border-top:1px solid var(--border);padding-top:.875rem;margin-top:.25rem">
        <label class="form-label" style="margin-bottom:.5rem">📎 Přílohy</label>
        <div id="hr-edit-attachments"><div class="loading" style="font-size:.8rem">Načítám přílohy…</div></div>
      </div>
    `, {
      saveLabel: 'Uložit',
      onSave: async () => {
        const title = document.getElementById('hr-title')?.value.trim();
        if (!title) { App.toast('Zadejte název.', 'error'); return; }
        const { error } = await db.from('health_records').update({
          title,
          type:      document.getElementById('hr-type')?.value,
          member_id: document.getElementById('hr-member')?.value || null,
          date:      document.getElementById('hr-date')?.value || null,
          next_date: document.getElementById('hr-next')?.value || null,
          doctor:    document.getElementById('hr-doctor')?.value.trim() || null,
          notes:     document.getElementById('hr-notes')?.value.trim() || null,
          ...collectExtra(),
        }).eq('id', id);
        if (error) { App.toast('Chyba: ' + error.message, 'error'); return; }
        App.toast('Uloženo ✓', 'success');
        App.closeModal();
        loadTab(activeTab);
      }
    });
    // Load attachments inline after modal renders
    Docs.renderInto('health', id, 'hr-edit-attachments');
  }

  async function deleteRecord(id) {
    if (!confirm('Smazat zdravotní záznam?')) return;
    await db.from('health_records').delete().eq('id', id);
    App.toast('Smazáno.', '');
    loadTab(activeTab);
  }

  return { load, filterByMember, filterByType, openAddRecord, editRecord, deleteRecord, onTypeChange, addToCalendar };
})();

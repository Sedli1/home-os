/* ═══════════════════════════════════════════════
   Home OS — modul Rodina
   ═══════════════════════════════════════════════ */

const Rodina = (() => {
  let activeTab = 'udalosti';
  let members   = [];

  // ── České jmeniny ─────────────────────────────
  const NAME_DAYS = {
    "01-01":"Noel","01-02":"Karina","01-03":"Radmila","01-04":"Diana","01-05":"Dalimil","01-06":"Tři králové","01-07":"Vilma","01-08":"Čestmír","01-09":"Vladan","01-10":"Břetislav","01-11":"Bohdana","01-12":"Pravoslav","01-13":"Edita","01-14":"Radovan","01-15":"Alice","01-16":"Ctirad","01-17":"Drahoslav","01-18":"Vladislav","01-19":"Doubravka","01-20":"Ilona","01-21":"Běla","01-22":"Slavomír","01-23":"Zdeněk","01-24":"Milena","01-25":"Miloš","01-26":"Zora","01-27":"Ingrid","01-28":"Otýlie","01-29":"Zdislava","01-30":"Robin","01-31":"Marika",
    "02-01":"Hynek","02-02":"Nela","02-03":"Blažej","02-04":"Jarmila","02-05":"Dobromila","02-06":"Vanda","02-07":"Veronika","02-08":"Milada","02-09":"Apolena","02-10":"Mojmír","02-11":"Božena","02-12":"Slavěna","02-13":"Věnceslava","02-14":"Valentýn","02-15":"Jiřina","02-16":"Ljuba","02-17":"Miloslav","02-18":"Gizela","02-19":"Vlastimil","02-20":"Oldřiška","02-21":"Lenka","02-22":"Petr","02-23":"Svatopluk","02-24":"Matěj","02-25":"Liliana","02-26":"Dorota","02-27":"Alexandr","02-28":"Lumír",
    "03-01":"Bedřich","03-02":"Anežka","03-03":"Kamil","03-04":"Stela","03-05":"Kazimír","03-06":"Miroslav","03-07":"Tomáš","03-08":"Gabriela","03-09":"Františka","03-10":"Viktorie","03-11":"Anděla","03-12":"Řehoř","03-13":"Růžena","03-14":"Matylda","03-15":"Ida","03-16":"Elena","03-17":"Vlastimil","03-18":"Eduard","03-19":"Josef","03-20":"Světlana","03-21":"Radek","03-22":"Leona","03-23":"Ivona","03-24":"Gabriel","03-25":"Marie","03-26":"Emanuel","03-27":"Dita","03-28":"Soňa","03-29":"Taťána","03-30":"Arnošt","03-31":"Kvído",
    "04-01":"Hugo","04-02":"Erika","04-03":"Richard","04-04":"Ivana","04-05":"Miroslava","04-06":"Vendula","04-07":"Heřman","04-08":"Ema","04-09":"Dušan","04-10":"Dáša","04-11":"Izabela","04-12":"Julius","04-13":"Aleš","04-14":"Vincenc","04-15":"Anastázie","04-16":"Irena","04-17":"Rudolf","04-18":"Valérie","04-19":"Rostislav","04-20":"Marcela","04-21":"Alexandra","04-22":"Evženie","04-23":"Vojtěch","04-24":"Jiří","04-25":"Marek","04-26":"Ota","04-27":"Jaroslav","04-28":"Vlastislav","04-29":"Robert","04-30":"Blahoslav",
    "05-01":"Svátek práce","05-02":"Zikmund","05-03":"Alexej","05-04":"Květoslav","05-05":"Klára","05-06":"Radoslav","05-07":"Stanislav","05-08":"Den vítězství","05-09":"Ctibor","05-10":"Blažena","05-11":"Svatava","05-12":"Pankrác","05-13":"Servác","05-14":"Bonifác","05-15":"Žofie","05-16":"Přemysl","05-17":"Aneta","05-18":"Nataša","05-19":"Ivo","05-20":"Zbyněk","05-21":"Monika","05-22":"Emil","05-23":"Vladimír","05-24":"Jana","05-25":"Viola","05-26":"Filip","05-27":"Valdemar","05-28":"Vilém","05-29":"Maxmilián","05-30":"Ferdinand","05-31":"Kamila",
    "06-01":"Laura","06-02":"Jarmil","06-03":"Tamara","06-04":"Dalibor","06-05":"Dobroslav","06-06":"Norbert","06-07":"Iveta","06-08":"Medard","06-09":"Stanislava","06-10":"Mariana","06-11":"Bruno","06-12":"Antonie","06-13":"Antonín","06-14":"Roland","06-15":"Vít","06-16":"Zbyněk","06-17":"Adolf","06-18":"Milan","06-19":"Leoš","06-20":"Květa","06-21":"Alois","06-22":"Pavla","06-23":"Zdeňka","06-24":"Jan","06-25":"Ivan","06-26":"Adriana","06-27":"Ladislav","06-28":"Lubomír","06-29":"Petr","06-30":"Šárka",
    "07-01":"Jaroslava","07-02":"Patricie","07-03":"Radomír","07-04":"Prokop","07-05":"Cyril a Metoděj","07-06":"Jan Hus","07-07":"Bohuslava","07-08":"Nelly","07-09":"Luděk","07-10":"Libuše","07-11":"Olga","07-12":"Bořek","07-13":"Markéta","07-14":"Karolína","07-15":"Jindřich","07-16":"Luboš","07-17":"Martina","07-18":"Drahomíra","07-19":"Čeněk","07-20":"Ilja","07-21":"Vítězslav","07-22":"Magdalena","07-23":"Libor","07-24":"Kristýna","07-25":"Jakub","07-26":"Anna","07-27":"Věroslav","07-28":"Viktor","07-29":"Marta","07-30":"Bořivoj","07-31":"Ignác",
    "08-01":"Oskar","08-02":"Gustav","08-03":"Miluše","08-04":"Dominik","08-05":"Kristián","08-06":"Oldřich","08-07":"Lada","08-08":"Soběslav","08-09":"Roman","08-10":"Vavřinec","08-11":"Zuzana","08-12":"Klára","08-13":"Alena","08-14":"Arnošt","08-15":"Hana","08-16":"Jáchym","08-17":"Petra","08-18":"Helena","08-19":"Ludvík","08-20":"Bernard","08-21":"Johana","08-22":"Bohuslav","08-23":"Sandra","08-24":"Bartoloměj","08-25":"Radim","08-26":"Luděk","08-27":"Otakar","08-28":"Augustýn","08-29":"Evelína","08-30":"Vladěna","08-31":"Pavlína",
    "09-01":"Linda","09-02":"Adéla","09-03":"Bronislav","09-04":"Jindřiška","09-05":"Boris","09-06":"Boleslav","09-07":"Regína","09-08":"Mariana","09-09":"Daniela","09-10":"Irma","09-11":"Denisa","09-12":"Marie","09-13":"Lubor","09-14":"Radka","09-15":"Jolana","09-16":"Ludmila","09-17":"Naděžda","09-18":"Kryštof","09-19":"Zita","09-20":"Oleg","09-21":"Matouš","09-22":"Darina","09-23":"Bořislava","09-24":"Jaromír","09-25":"Zlata","09-26":"Andrea","09-27":"Jonáš","09-28":"Václav","09-29":"Michal","09-30":"Jeroným",
    "10-01":"Igor","10-02":"Olívie","10-03":"Bohumila","10-04":"František","10-05":"Eliška","10-06":"Hanuš","10-07":"Justýna","10-08":"Věra","10-09":"Štefan","10-10":"Marina","10-11":"Andrej","10-12":"Marcel","10-13":"Renáta","10-14":"Agáta","10-15":"Tereza","10-16":"Havel","10-17":"Hedvika","10-18":"Lukáš","10-19":"Michaela","10-20":"Vendelín","10-21":"Brigita","10-22":"Sabina","10-23":"Teodor","10-24":"Nina","10-25":"Beáta","10-26":"Erik","10-27":"Šarlota","10-28":"Státní svátek","10-29":"Silvie","10-30":"Tadeáš","10-31":"Štěpánka",
    "11-01":"Felix","11-02":"Dušičky","11-03":"Hubert","11-04":"Karel","11-05":"Miriam","11-06":"Liběna","11-07":"Saskie","11-08":"Bohdan","11-09":"Bohunka","11-10":"Evžen","11-11":"Martin","11-12":"Benedikt","11-13":"Tibor","11-14":"Samu","11-15":"Leopold","11-16":"Otmar","11-17":"Mahulena","11-18":"Romana","11-19":"Alžběta","11-20":"Nikola","11-21":"Albert","11-22":"Cecílie","11-23":"Klement","11-24":"Emílie","11-25":"Kateřina","11-26":"Artur","11-27":"Xenie","11-28":"René","11-29":"Zina","11-30":"Ondřej",
    "12-01":"Iva","12-02":"Blanka","12-03":"Svatoslav","12-04":"Barbora","12-05":"Jitka","12-06":"Mikuláš","12-07":"Ambrož","12-08":"Květoslava","12-09":"Vratislav","12-10":"Julie","12-11":"Dana","12-12":"Simona","12-13":"Lucie","12-14":"Lýdie","12-15":"Radan","12-16":"Albína","12-17":"Daniel","12-18":"Miloslav","12-19":"Ester","12-20":"Dagmar","12-21":"Natálie","12-22":"Šimon","12-23":"Vlasta","12-24":"Adam a Eva","12-25":"Bohdana","12-26":"Štěpán","12-27":"Žaneta","12-28":"Bohumila","12-29":"Judita","12-30":"Dávid","12-31":"Silvestr"
  };

  // Reverzní lookup: jméno → "MM-DD"
  const NAME_DAY_LOOKUP = {};
  Object.entries(NAME_DAYS).forEach(([mmdd, name]) => {
    name.split(' ').forEach(n => {
      NAME_DAY_LOOKUP[n.toLowerCase()] = mmdd;
    });
  });

  // Pevné svátky a speciální příležitosti
  const SPECIAL_DAYS = [
    { mmdd: "02-14", title: "💝 Valentýn", type: "svátek" },
    { mmdd: "03-08", title: "🌷 Mezinárodní den žen (MDŽ)", type: "svátek" },
  ];

  // Výpočet: 2. neděle v květnu = Den matek, 3. neděle v červnu = Den otců
  function getNthWeekday(year, month, weekday, n) {
    // weekday: 0=Sun,1=Mon,...6=Sat; n: which occurrence (1-based)
    const d = new Date(year, month, 1);
    let count = 0;
    while (d.getMonth() === month) {
      if (d.getDay() === weekday) { count++; if (count === n) return new Date(d); }
      d.setDate(d.getDate() + 1);
    }
    return null;
  }

  function getNameDayEvents(mems, todayStr, year) {
    const events = [];
    const seen = new Set();
    (mems ?? []).forEach(m => {
      const firstName = m.name.split(' ')[0];
      const mmdd = NAME_DAY_LOOKUP[firstName.toLowerCase()];
      if (!mmdd) return;
      const key = mmdd + '-' + m.id;
      if (seen.has(key)) return;
      seen.add(key);
      const nextDate = new Date(`${year}-${mmdd}T00:00:00`);
      if (nextDate.toISOString().split('T')[0] < todayStr) {
        nextDate.setFullYear(year + 1);
      }
      const dateStr = nextDate.toISOString().split('T')[0];
      events.push({
        id: `nameday-${m.id}`,
        title: `Jmeniny — ${m.name}`,
        date: dateStr,
        type: 'jmeniny',
        family_members: { name: m.name, color: m.color ?? '#f472b6' },
        _synthetic: true,
      });
    });
    return events;
  }

  function getSpecialEvents(todayStr, year) {
    const events = [];
    SPECIAL_DAYS.forEach(s => {
      let dateStr = `${year}-${s.mmdd}`;
      if (dateStr < todayStr) dateStr = `${year + 1}-${s.mmdd}`;
      events.push({ id: `special-${s.mmdd}`, title: s.title, date: dateStr, type: s.type, _synthetic: true });
    });
    // Den matek — 2. neděle v květnu
    for (const y of [year, year + 1]) {
      const dm = getNthWeekday(y, 4, 0, 2); // May = month index 4
      if (dm) {
        const ds = dm.toISOString().split('T')[0];
        if (ds >= todayStr) { events.push({ id: `mothers-${y}`, title: '🌸 Den matek', date: ds, type: 'svátek', _synthetic: true }); break; }
      }
    }
    // Den otců — 3. neděle v červnu
    for (const y of [year, year + 1]) {
      const df = getNthWeekday(y, 5, 0, 3); // June = month index 5
      if (df) {
        const ds = df.toISOString().split('T')[0];
        if (ds >= todayStr) { events.push({ id: `fathers-${y}`, title: '👨 Den otců', date: ds, type: 'svátek', _synthetic: true }); break; }
      }
    }
    return events;
  }

  async function load() {
    const { data } = await db.from('family_members').select('*').order('name');
    members = data ?? [];
    renderTabs();
    loadTab(activeTab);
  }

  function renderTabs() {
    document.querySelectorAll('#page-rodina .tab-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        activeTab = btn.dataset.tab;
        document.querySelectorAll('#page-rodina .tab-btn').forEach(b => b.classList.remove('active'));
        document.querySelectorAll('#page-rodina .tab-panel').forEach(p => p.classList.remove('active'));
        btn.classList.add('active');
        document.getElementById(`tab-${activeTab}`)?.classList.add('active');
        loadTab(activeTab);
      });
    });
  }

  function loadTab(tab) {
    switch (tab) {
      case 'udalosti': loadEvents(); break;
      case 'clenove':  loadMembers(); loadBirthdays(); break;
    }
  }

  // ── Události ────────────────────────────────
  async function loadEvents() {
    const el = document.getElementById('events-list');
    el.innerHTML = '<div class="loading"><div class="spinner"></div> Načítám…</div>';

    const today = new Date(); today.setHours(0,0,0,0);
    const todayStr = today.toISOString().split('T')[0];

    const [{ data: evData, error }, { data: mems }] = await Promise.all([
      db.from('family_events')
        .select('*, family_members(name,color)')
        .gte('date', todayStr)
        .order('date')
        .limit(50),
      db.from('family_members').select('*').not('birth_date', 'is', null)
    ]);

    if (error) { el.innerHTML = `<div class="empty-state"><div class="empty-text">Chyba: ${App.esc(error.message)}</div></div>`; return; }

    // Syntetické narozeninové události z birth_date členů
    const synthetic = [];
    (mems ?? []).forEach(m => {
      const bd = new Date(m.birth_date + 'T00:00:00');
      const next = nextOccurrence(bd);
      const nextStr = next.toISOString().split('T')[0];
      if (nextStr >= todayStr) {
        synthetic.push({
          id: 'bday-' + m.id,
          title: `Narozeniny — ${m.name}`,
          date: nextStr,
          type: 'narozeniny',
          recurring: true,
          family_members: { name: m.name, color: m.color ?? '#ec4899' },
          _age: next.getFullYear() - bd.getFullYear(),
          _synthetic: true,
        });
      }
    });

    const today2 = new Date(); today2.setHours(0,0,0,0);
    const nameDayEvents = getNameDayEvents(mems, todayStr, today2.getFullYear());
    const specialEvents = getSpecialEvents(todayStr, today2.getFullYear());

    const allEvents = [...(evData ?? []), ...synthetic, ...nameDayEvents, ...specialEvents]
      .sort((a, b) => a.date.localeCompare(b.date))
      .slice(0, 60);

    if (!allEvents.length) {
      el.innerHTML = `<div class="empty-state">
        <div class="empty-icon">📅</div>
        <div class="empty-title">Žádné nadcházející události</div>
        <div class="empty-text">Přidejte první událost nebo přidejte členům rodiny datum narození.</div>
        <button class="btn btn-primary" style="margin-top:1rem" onclick="document.getElementById('addEventBtn').click()">+ Přidat událost →</button>
      </div>`;
      return;
    }

    el.innerHTML = allEvents.map(ev => {
      const d = new Date(ev.date + 'T00:00:00');
      const days = App.daysUntil(ev.date);
      const ageBadge = ev._age ? `<span class="age-badge" style="background:${App.typeColor(ev.type)}18;color:${App.typeColor(ev.type)};border:1.5px solid ${App.typeColor(ev.type)}33">${ev._age} let</span>` : '';
      return `<div class="event-item" data-id="${ev.id}">
        <div class="event-date-box" style="background:${App.typeColor(ev.type)}18;color:${App.typeColor(ev.type)}">
          <span class="day">${d.getDate()}</span>
          <span class="mon">${d.toLocaleDateString('cs-CZ', { month: 'short' })}</span>
        </div>
        <div class="event-body">
          <div class="event-title">${App.esc(ev.title)} ${ageBadge}</div>
          <div class="event-meta">
            ${App.typeLabel(ev.type)}
            ${ev.family_members ? ` · <span style="color:${ev.family_members.color}">${App.esc(ev.family_members.name)}</span>` : ''}
            ${ev.recurring ? ' · 🔁 opakuje se' : ''}
            ${ev.notes ? ' · ' + App.esc(ev.notes) : ''}
          </div>
        </div>
        <div style="display:flex;align-items:center;gap:.5rem">
          ${App.countdownBadge(days)}
          ${!ev._synthetic ? `<div class="event-actions">
            <button class="btn btn-icon btn-ghost btn-sm" onclick="Rodina.editEvent('${ev.id}')" title="Upravit">✏️</button>
            <button class="btn btn-icon btn-ghost btn-sm" onclick="Rodina.deleteEvent('${ev.id}')" title="Smazat">🗑️</button>
          </div>` : ''}
        </div>
      </div>`;
    }).join('');
  }

  const EVENT_TYPES = [
    { value: 'jiné',           label: '📌 Jiné' },
    { value: 'narozeniny',     label: '🎂 Narozeniny' },
    { value: 'jmeniny',        label: '🌸 Jmeniny' },
    { value: 'výročí',         label: '💍 Výročí' },
    { value: 'výročí-svatby',  label: '💒 Výročí svatby' },
    { value: 'kroužek',        label: '⚽ Kroužek' },
    { value: 'lékař',          label: '🏥 Lékař' },
    { value: 'škola',          label: '🎒 Škola' },
    { value: 'dovolená',       label: '✈️ Dovolená' },
  ];

  function openAddEvent() {
    const memberOptions = members.map(m =>
      `<option value="${m.id}">${App.esc(m.name)}</option>`
    ).join('');

    App.openModal('📅 Nová událost', `
      <div class="form-group">
        <label class="form-label">Název *</label>
        <input id="ev-title" class="form-control" placeholder="např. Narozeniny Pavla" required>
      </div>
      <div class="form-row">
        <div class="form-group">
          <label class="form-label">Datum *</label>
          <input id="ev-date" type="date" class="form-control" value="${new Date().toISOString().split('T')[0]}">
        </div>
        <div class="form-group">
          <label class="form-label">Typ</label>
          <select id="ev-type" class="form-control">
            ${EVENT_TYPES.map(t => `<option value="${t.value}">${t.label}</option>`).join('')}
          </select>
        </div>
      </div>
      ${memberOptions ? `<div class="form-group">
        <label class="form-label">Člen rodiny</label>
        <select id="ev-member" class="form-control">
          <option value="">— nikdo —</option>
          ${memberOptions}
        </select>
      </div>` : ''}
      <div class="form-group">
        <label class="form-label" style="display:flex;align-items:center;gap:.5rem;cursor:pointer">
          <input type="checkbox" id="ev-recurring"> Opakuje se každý rok
        </label>
      </div>
      <div class="form-group">
        <label class="form-label">Poznámka</label>
        <input id="ev-notes" class="form-control" placeholder="Volitelně…">
      </div>
    `, {
      saveLabel: 'Přidat událost',
      onSave: saveNewEvent
    });
  }

  async function saveNewEvent() {
    const title = document.getElementById('ev-title')?.value.trim();
    const date  = document.getElementById('ev-date')?.value;
    if (!title || !date) { App.toast('Vyplňte název a datum.', 'error'); return; }
    const { error } = await db.from('family_events').insert({
      title, date,
      type:      document.getElementById('ev-type')?.value ?? 'jiné',
      recurring: document.getElementById('ev-recurring')?.checked ?? false,
      member_id: document.getElementById('ev-member')?.value || null,
      notes:     document.getElementById('ev-notes')?.value.trim() || null,
    });
    if (error) { App.toast('Chyba: ' + error.message, 'error'); return; }
    App.toast('Událost přidána ✓', 'success');
    App.closeModal();
    loadEvents();
  }

  async function editEvent(id) {
    const { data: ev, error } = await db.from('family_events').select('*').eq('id', id).single();
    if (error || !ev) { App.toast('Událost nenalezena.', 'error'); return; }
    const memberOptions = members.map(m =>
      `<option value="${m.id}" ${m.id === ev.member_id ? 'selected' : ''}>${App.esc(m.name)}</option>`
    ).join('');
    App.openModal('✏️ Upravit událost', `
      <div class="form-group">
        <label class="form-label">Název *</label>
        <input id="ev-title" class="form-control" value="${App.esc(ev.title)}">
      </div>
      <div class="form-row">
        <div class="form-group">
          <label class="form-label">Datum *</label>
          <input id="ev-date" type="date" class="form-control" value="${ev.date}">
        </div>
        <div class="form-group">
          <label class="form-label">Typ</label>
          <select id="ev-type" class="form-control">
            ${EVENT_TYPES.map(t => `<option value="${t.value}" ${ev.type === t.value ? 'selected' : ''}>${t.label}</option>`).join('')}
          </select>
        </div>
      </div>
      ${memberOptions ? `<div class="form-group">
        <label class="form-label">Člen rodiny</label>
        <select id="ev-member" class="form-control">
          <option value="">— nikdo —</option>
          ${memberOptions}
        </select>
      </div>` : ''}
      <div class="form-group">
        <label class="form-label" style="display:flex;align-items:center;gap:.5rem;cursor:pointer">
          <input type="checkbox" id="ev-recurring" ${ev.recurring ? 'checked' : ''}> Opakuje se každý rok
        </label>
      </div>
      <div class="form-group">
        <label class="form-label">Poznámka</label>
        <input id="ev-notes" class="form-control" value="${App.esc(ev.notes ?? '')}">
      </div>
    `, {
      saveLabel: 'Uložit změny',
      onSave: async () => {
        const title = document.getElementById('ev-title')?.value.trim();
        const date  = document.getElementById('ev-date')?.value;
        if (!title || !date) { App.toast('Vyplňte název a datum.', 'error'); return; }
        const { error } = await db.from('family_events').update({
          title, date,
          type:      document.getElementById('ev-type')?.value,
          recurring: document.getElementById('ev-recurring')?.checked,
          member_id: document.getElementById('ev-member')?.value || null,
          notes:     document.getElementById('ev-notes')?.value.trim() || null,
        }).eq('id', id);
        if (error) { App.toast('Chyba: ' + error.message, 'error'); return; }
        App.toast('Uloženo ✓', 'success');
        App.closeModal();
        loadEvents();
      }
    });
  }

  async function deleteEvent(id) {
    if (!confirm('Smazat tuto událost?')) return;
    const { error } = await db.from('family_events').delete().eq('id', id);
    if (error) { App.toast('Chyba: ' + error.message, 'error'); return; }
    App.toast('Smazáno.', '');
    loadEvents();
  }

  // ── Narozeniny & výročí ──────────────────────
  async function loadBirthdays() {
    const el = document.getElementById('birthdays-list');
    el.innerHTML = '<div class="loading"><div class="spinner"></div> Načítám…</div>';

    const [{ data: evs }, { data: mems }] = await Promise.all([
      db.from('family_events').select('*').in('type', ['narozeniny', 'výročí', 'jmeniny', 'výročí-svatby']).order('date'),
      db.from('family_members').select('*').not('birth_date', 'is', null)
    ]);

    const today = new Date(); today.setHours(0,0,0,0);
    const items = [];

    (mems ?? []).forEach(m => {
      const bd = new Date(m.birth_date + 'T00:00:00');
      const next = nextOccurrence(bd);
      const days = Math.round((next - today) / 86400000);
      const age  = next.getFullYear() - bd.getFullYear();
      items.push({ title: `🎂 ${m.name}`, sub: 'Narozeniny', date: next, days, color: m.color ?? '#ec4899', age, memberId: m.id });
    });

    (evs ?? []).forEach(ev => {
      const d = new Date(ev.date + 'T00:00:00');
      const next = ev.recurring ? nextOccurrence(d) : d;
      const days = Math.round((next - today) / 86400000);
      const icons = { narozeniny: '🎂', jmeniny: '🌸', 'výročí': '💍', 'výročí-svatby': '💒' };
      items.push({
        title: `${icons[ev.type] ?? '📌'} ${ev.title}`,
        sub: ev.notes ?? '',
        date: next,
        days,
        color: App.typeColor(ev.type),
      });
    });

    items.sort((a, b) => a.days - b.days);

    if (!items.length) {
      el.innerHTML = `<div class="empty-state">
        <div class="empty-icon">🎂</div>
        <div class="empty-title">Žádné narozeniny a výročí</div>
        <div class="empty-text">Přidejte členům rodiny datum narození nebo vytvořte událost typu narozeniny/výročí.</div>
        <button class="btn btn-outline" style="margin-top:1rem" onclick="App.navigateTo('rodina')">+ Přidat člena rodiny →</button>
      </div>`;
      return;
    }

    el.innerHTML = items.map(item => `
      <div class="event-item">
        <div class="event-date-box" style="background:${item.color}18;color:${item.color}">
          <span class="day">${item.date.getDate()}</span>
          <span class="mon">${item.date.toLocaleDateString('cs-CZ',{month:'short'})}</span>
        </div>
        <div class="event-body">
          <div class="event-title" style="display:flex;align-items:center;gap:.5rem;flex-wrap:wrap">
            ${item.title}
            ${item.age ? `<span class="age-badge" style="background:${item.color}18;color:${item.color};border:1.5px solid ${item.color}44">${item.age} let</span>` : ''}
          </div>
          <div class="event-meta">${item.sub}</div>
        </div>
        ${App.countdownBadge(item.days)}
      </div>
    `).join('');
  }

  function nextOccurrence(date) {
    const today = new Date(); today.setHours(0,0,0,0);
    const d = new Date(today.getFullYear(), date.getMonth(), date.getDate());
    if (d < today) d.setFullYear(d.getFullYear() + 1);
    return d;
  }

  // ── Členové ──────────────────────────────────
  async function loadMembers() {
    const el = document.getElementById('members-list');
    el.innerHTML = '<div class="loading"><div class="spinner"></div> Načítám…</div>';

    const { data, error } = await db.from('family_members').select('*').order('name');
    if (error) { el.innerHTML = `<div class="empty-state"><div class="empty-text">Chyba: ${App.esc(error.message)}</div></div>`; return; }

    if (!data.length) {
      el.innerHTML = `<div class="empty-state">
        <div class="empty-icon">👨‍👩‍👧‍👦</div>
        <div class="empty-title">Žádní členové rodiny</div>
        <div class="empty-text">Přidejte první člen rodiny a začněte sledovat narozeniny a události.</div>
        <button class="btn btn-primary" style="margin-top:1rem" onclick="document.getElementById('addMemberBtn').click()">+ Přidat člena rodiny →</button>
      </div>`;
      return;
    }

    el.innerHTML = `<div class="grid-2" style="gap:.75rem">${data.map(m => {
      const today = new Date();
      let ageStr = '';
      if (m.birth_date) {
        const bd = new Date(m.birth_date + 'T00:00:00');
        const age = today.getFullYear() - bd.getFullYear() - (today < new Date(today.getFullYear(), bd.getMonth(), bd.getDate()) ? 1 : 0);
        ageStr = `· <span class="age-badge" style="background:${(m.color??'#6366f1')}18;color:${(m.color??'#6366f1')};border:1.5px solid ${(m.color??'#6366f1')}44">${age} let</span>`;
      }
      return `<div class="card member-card" style="cursor:pointer" onclick="Rodina.showMemberDetail('${m.id}')">
        <div class="card-body" style="display:flex;align-items:center;gap:1rem">
          <div style="width:48px;height:48px;border-radius:50%;background:${m.color ?? '#6366f1'};display:flex;align-items:center;justify-content:center;color:#fff;font-weight:700;font-size:1.1rem;flex-shrink:0">
            ${App.esc(m.name[0])}
          </div>
          <div style="flex:1;min-width:0">
            <div style="font-weight:700;display:flex;align-items:center;gap:.5rem;flex-wrap:wrap">${App.esc(m.name)} ${ageStr}</div>
            <div style="font-size:.8rem;color:var(--text-muted)">${App.esc(m.role ?? 'člen')}${m.birth_date ? ' · ' + App.formatDate(m.birth_date) : ''}</div>
            ${m.phone ? `<div style="font-size:.8rem;color:var(--text-muted)">📞 ${App.esc(m.phone)}</div>` : ''}
          </div>
          <div style="display:flex;gap:.25rem" onclick="event.stopPropagation()">
            <button class="btn btn-icon btn-ghost btn-sm" onclick="Rodina.editMember('${m.id}')">✏️</button>
            <button class="btn btn-icon btn-ghost btn-sm" onclick="Rodina.deleteMember('${m.id}')">🗑️</button>
          </div>
        </div>
      </div>`;
    }).join('')}</div>`;
  }

  async function showMemberDetail(id) {
    const m = members.find(x => x.id === id) || (await db.from('family_members').select('*').eq('id', id).single()).data;
    if (!m) return;

    const { data: records } = await db.from('health_records').select('*').eq('member_id', id).order('date', { ascending: false }).limit(5);

    const today = new Date();
    let age = '';
    if (m.birth_date) {
      const bd = new Date(m.birth_date + 'T00:00:00');
      const a = today.getFullYear() - bd.getFullYear() - (today < new Date(today.getFullYear(), bd.getMonth(), bd.getDate()) ? 1 : 0);
      age = `<span class="age-badge" style="background:${(m.color??'#6366f1')}18;color:${(m.color??'#6366f1')};border:1.5px solid ${(m.color??'#6366f1')}44;font-size:.875rem;padding:.3rem .75rem">${a} let</span>`;
    }

    const healthHtml = records?.length ? records.map(r => `
      <div style="display:flex;justify-content:space-between;align-items:center;padding:.375rem 0;border-bottom:1px solid var(--border);font-size:.875rem">
        <span>${App.esc(r.title)} <span style="color:var(--text-muted);font-size:.78rem">${r.type}</span></span>
        <span style="color:var(--text-muted)">${r.date ? App.formatDate(r.date) : ''}</span>
      </div>`).join('') : '<div style="color:var(--text-muted);font-size:.875rem">Žádné zdravotní záznamy.</div>';

    App.openModal(`👤 ${App.esc(m.name)}`, `
      <div style="display:flex;align-items:center;gap:1rem;margin-bottom:1.5rem">
        <div style="width:64px;height:64px;border-radius:50%;background:${m.color??'#6366f1'};display:flex;align-items:center;justify-content:center;color:#fff;font-weight:700;font-size:1.5rem;flex-shrink:0">
          ${App.esc(m.name[0])}
        </div>
        <div>
          <div style="font-size:1.25rem;font-weight:700">${App.esc(m.name)} ${age}</div>
          <div style="color:var(--text-muted)">${App.esc(m.role ?? 'člen')}</div>
        </div>
      </div>
      <div style="display:flex;flex-direction:column;gap:.625rem;margin-bottom:1.25rem">
        ${m.birth_date ? `<div style="display:flex;gap:.5rem;align-items:center;font-size:.9rem"><span style="color:var(--text-muted)">🎂 Narozeniny</span> <strong>${App.formatDate(m.birth_date)}</strong></div>` : ''}
        ${m.phone ? `<div style="display:flex;gap:.5rem;align-items:center;font-size:.9rem"><span style="color:var(--text-muted)">📞 Telefon</span> <strong>${App.esc(m.phone)}</strong></div>` : ''}
        ${m.contact_notes ? `<div style="font-size:.9rem;background:var(--surface2);padding:.625rem .875rem;border-radius:var(--radius)">${App.esc(m.contact_notes)}</div>` : ''}
      </div>
      <div style="font-size:.8rem;font-weight:600;color:var(--text-muted);text-transform:uppercase;letter-spacing:.05em;margin-bottom:.5rem">🏥 Zdravotní záznamy</div>
      ${healthHtml}
      <div style="margin-top:1rem;display:flex;gap:.5rem;flex-wrap:wrap">
        <button class="btn btn-outline btn-sm" onclick="App.closeModal();Rodina.editMember('${m.id}')">✏️ Upravit</button>
        <button class="btn btn-outline btn-sm" onclick="App.closeModal();App.navigateTo('zdravi')">🏥 Zdraví →</button>
      </div>
    `, { saveLabel: null });
  }

  function openAddMember() {
    App.openModal('👤 Nový člen rodiny', `
      <div class="form-group">
        <label class="form-label">Jméno *</label>
        <input id="mem-name" class="form-control" placeholder="např. Petra">
      </div>
      <div class="form-row">
        <div class="form-group">
          <label class="form-label">Role</label>
          <select id="mem-role" class="form-control">
            <option value="rodič">Rodič</option>
            <option value="dítě">Dítě</option>
            <option value="člen">Člen</option>
          </select>
        </div>
        <div class="form-group">
          <label class="form-label">Datum narození</label>
          <input id="mem-birth" type="date" class="form-control">
        </div>
      </div>
      <div class="form-group">
        <label class="form-label">Telefon</label>
        <input id="mem-phone" class="form-control" placeholder="+420 777 000 000">
      </div>
      <div class="form-group">
        <label class="form-label">Poznámky / kontakt</label>
        <textarea id="mem-notes" class="form-control" rows="2" placeholder="Volitelně…"></textarea>
      </div>
      <div class="form-group">
        <label class="form-label">Barva</label>
        <input id="mem-color" type="color" class="form-control" value="#6366f1" style="height:44px;padding:.25rem">
      </div>
    `, {
      saveLabel: 'Přidat člena',
      onSave: async () => {
        const name = document.getElementById('mem-name')?.value.trim();
        if (!name) { App.toast('Zadejte jméno.', 'error'); return; }
        const { error } = await db.from('family_members').insert({
          name,
          role:           document.getElementById('mem-role')?.value,
          birth_date:     document.getElementById('mem-birth')?.value || null,
          phone:          document.getElementById('mem-phone')?.value.trim() || null,
          contact_notes:  document.getElementById('mem-notes')?.value.trim() || null,
          color:          document.getElementById('mem-color')?.value,
        });
        if (error) { App.toast('Chyba: ' + error.message, 'error'); return; }
        App.toast('Člen přidán ✓', 'success');
        App.closeModal();
        const { data } = await db.from('family_members').select('*').order('name');
        members = data ?? [];
        loadMembers();
      }
    });
  }

  async function editMember(id) {
    const { data: m } = await db.from('family_members').select('*').eq('id', id).single();
    if (!m) return;
    App.openModal('✏️ Upravit člena', `
      <div class="form-group">
        <label class="form-label">Jméno *</label>
        <input id="mem-name" class="form-control" value="${App.esc(m.name)}">
      </div>
      <div class="form-row">
        <div class="form-group">
          <label class="form-label">Role</label>
          <select id="mem-role" class="form-control">
            ${['rodič','dítě','člen'].map(r => `<option value="${r}" ${m.role===r?'selected':''}>${r}</option>`).join('')}
          </select>
        </div>
        <div class="form-group">
          <label class="form-label">Datum narození</label>
          <input id="mem-birth" type="date" class="form-control" value="${m.birth_date ?? ''}">
        </div>
      </div>
      <div class="form-group">
        <label class="form-label">Telefon</label>
        <input id="mem-phone" class="form-control" value="${App.esc(m.phone ?? '')}">
      </div>
      <div class="form-group">
        <label class="form-label">Poznámky / kontakt</label>
        <textarea id="mem-notes" class="form-control" rows="2">${App.esc(m.contact_notes ?? '')}</textarea>
      </div>
      <div class="form-group">
        <label class="form-label">Barva</label>
        <input id="mem-color" type="color" class="form-control" value="${m.color ?? '#6366f1'}" style="height:44px;padding:.25rem">
      </div>
    `, {
      saveLabel: 'Uložit',
      onSave: async () => {
        const name = document.getElementById('mem-name')?.value.trim();
        if (!name) { App.toast('Zadejte jméno.', 'error'); return; }
        const { error } = await db.from('family_members').update({
          name,
          role:           document.getElementById('mem-role')?.value,
          birth_date:     document.getElementById('mem-birth')?.value || null,
          phone:          document.getElementById('mem-phone')?.value.trim() || null,
          contact_notes:  document.getElementById('mem-notes')?.value.trim() || null,
          color:          document.getElementById('mem-color')?.value,
        }).eq('id', id);
        if (error) { App.toast('Chyba: ' + error.message, 'error'); return; }
        App.toast('Uloženo ✓', 'success');
        App.closeModal();
        const { data } = await db.from('family_members').select('*').order('name');
        members = data ?? [];
        loadMembers();
      }
    });
  }

  async function deleteMember(id) {
    if (!confirm('Smazat člena rodiny?')) return;
    const { error } = await db.from('family_members').delete().eq('id', id);
    if (error) { App.toast('Chyba: ' + error.message, 'error'); return; }
    App.toast('Smazáno.', '');
    const { data } = await db.from('family_members').select('*').order('name');
    members = data ?? [];
    loadMembers();
  }

  document.getElementById('addEventBtn')?.addEventListener('click', openAddEvent);
  document.getElementById('addMemberBtn')?.addEventListener('click', openAddMember);

  return { load, editEvent, deleteEvent, editMember, deleteMember, showMemberDetail };
})();

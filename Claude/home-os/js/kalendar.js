/* ═══════════════════════════════════════════════
   Home OS — Kalendář (měsíční přehled)
   Agreguje události ze všech modulů.
   ═══════════════════════════════════════════════ */

const Kalendar = (() => {

  // ── Stav ──────────────────────────────────────
  const today = new Date();
  let currentYear  = today.getFullYear();
  let currentMonth = today.getMonth(); // 0-indexed
  let _bound = false;

  // ── Jmenný kalendář (česky) ───────────────────
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

  // ── Zvláštní dny (státní svátky) ──────────────
  const SPECIAL_DAYS = [
    { date: "02-14", title: "💝 Valentýn",                  type: "svátek" },
    { date: "03-08", title: "🌷 MDŽ — Mezinárodní den žen", type: "svátek" },
    { date: "01-01", title: "🎆 Nový rok",                  type: "svátek" },
    { date: "05-01", title: "🌷 Svátek práce",              type: "svátek" },
    { date: "05-08", title: "🕊️ Den vítězství",             type: "svátek" },
    { date: "07-05", title: "⛪ Cyril a Metoděj",           type: "svátek" },
    { date: "07-06", title: "🕯️ Jan Hus",                   type: "svátek" },
    { date: "09-28", title: "🇨🇿 Den české státnosti",      type: "svátek" },
    { date: "10-28", title: "🇨🇿 Vznik Československa",     type: "svátek" },
    { date: "11-17", title: "🕯️ Den boje za svobodu",       type: "svátek" },
    { date: "12-24", title: "🎄 Štědrý den",                type: "svátek" },
    { date: "12-25", title: "🎄 1. svátek vánoční",         type: "svátek" },
    { date: "12-26", title: "🎄 2. svátek vánoční",         type: "svátek" },
  ];

  // Barvy typů událostí
  const TYPE_COLORS = {
    narozeniny:      '#ec4899',
    jmeniny:         '#f472b6',
    'výročí-svatby': '#a78bfa',
    výročí:          '#8b5cf6',
    'lékař':         '#ef4444',
    zdraví:          '#ef4444',
    kroužek:         '#3b82f6',
    škola:           '#f59e0b',
    dovolená:        '#10b981',
    stk:             '#3b82f6',
    pojisteni:       '#3b82f6',
    smlouva:         '#f59e0b',
    svátek:          '#94a3b8',
    jiné:            '#6366f1',
  };

  function eventColor(type) {
    return TYPE_COLORS[type] ?? '#6366f1';
  }

  // ── Pomocné ────────────────────────────────────

  /** Vrátí "YYYY-MM-DD" string pro daný Date objekt */
  function dateKey(d) {
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  }

  /** Přidá událost do eventMap */
  function addEvent(map, key, ev) {
    if (!map[key]) map[key] = [];
    map[key].push(ev);
  }

  /** Druhá neděle v květnu daného roku (Den matek) */
  function mothersDay(year) {
    let sundays = 0;
    for (let d = 1; d <= 31; d++) {
      const dt = new Date(year, 4, d); // květen = 4
      if (dt.getMonth() !== 4) break;
      if (dt.getDay() === 0) { // neděle
        sundays++;
        if (sundays === 2) return dt;
      }
    }
    return null;
  }

  /** Najde datum jmenin pro dané jméno (case-insensitive) v aktuálním roce */
  function findNameDay(firstName, year) {
    const lc = firstName.trim().toLowerCase();
    for (const [mmdd, name] of Object.entries(NAME_DAYS)) {
      if (name.toLowerCase() === lc) {
        const [mm, dd] = mmdd.split('-');
        return `${year}-${mm}-${dd}`;
      }
    }
    return null;
  }

  /** Vrátí první slovo ze jména (křestní jméno) */
  function firstName(fullName) {
    return (fullName ?? '').split(/\s+/)[0];
  }

  /** HTML escape */
  function esc(str) {
    return String(str ?? '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
  }

  // ── Navigace / Label ───────────────────────────
  const MONTH_NAMES_CS = [
    'Leden','Únor','Březen','Duben','Květen','Červen',
    'Červenec','Srpen','Září','Říjen','Listopad','Prosinec'
  ];

  function updateLabel() {
    const el = document.getElementById('kalMonthLabel');
    if (el) el.textContent = `${MONTH_NAMES_CS[currentMonth]} ${currentYear}`;
  }

  // ── load() ─────────────────────────────────────
  function load() {
    if (!_bound) {
      const prevBtn = document.getElementById('kalPrevBtn');
      const nextBtn = document.getElementById('kalNextBtn');

      if (prevBtn) {
        prevBtn.addEventListener('click', () => {
          currentMonth--;
          if (currentMonth < 0) { currentMonth = 11; currentYear--; }
          updateLabel();
          buildCalendar();
        });
      }

      if (nextBtn) {
        nextBtn.addEventListener('click', () => {
          currentMonth++;
          if (currentMonth > 11) { currentMonth = 0; currentYear++; }
          updateLabel();
          buildCalendar();
        });
      }

      // Tab switching — Kalendář vs Upozornění
      document.getElementById('kalTabGrid')?.addEventListener('click', () => {
        document.getElementById('kalTabGrid').classList.add('active');
        document.getElementById('kalTabNotif').classList.remove('active');
        document.getElementById('kal-tab-grid').classList.add('active');
        document.getElementById('kal-tab-notif').classList.remove('active');
        document.getElementById('kalNavActions')?.style.setProperty('display', '');
      });
      document.getElementById('kalTabNotif')?.addEventListener('click', () => {
        document.getElementById('kalTabNotif').classList.add('active');
        document.getElementById('kalTabGrid').classList.remove('active');
        document.getElementById('kal-tab-notif').classList.add('active');
        document.getElementById('kal-tab-grid').classList.remove('active');
        document.getElementById('kalNavActions')?.style.setProperty('display', 'none');
        Notifikace.load();
      });

      _bound = true;
    }

    // Ensure calendar tab is active when loading
    document.getElementById('kalTabGrid')?.classList.add('active');
    document.getElementById('kalTabNotif')?.classList.remove('active');
    document.getElementById('kal-tab-grid')?.classList.add('active');
    document.getElementById('kal-tab-notif')?.classList.remove('active');
    document.getElementById('kalNavActions')?.style.setProperty('display', '');

    updateLabel();
    buildCalendar();
  }

  // ── buildCalendar() ────────────────────────────
  async function buildCalendar() {
    const container = document.getElementById('kalendar-content');
    if (!container) return;

    // Zobraz loading
    container.innerHTML = '<div class="kal-loading">Načítám kalendář…</div>';

    // Rozsah měsíce ± 7 dní pro fetch
    const firstDay = new Date(currentYear, currentMonth, 1);
    const lastDay  = new Date(currentYear, currentMonth + 1, 0);
    const rangeFrom = new Date(firstDay.getTime() - 7 * 86400000);
    const rangeTo   = new Date(lastDay.getTime()  + 7 * 86400000);
    const fromStr = dateKey(rangeFrom);
    const toStr   = dateKey(rangeTo);

    // ── Paralelní fetch ze všech modulů ──────────
    const [
      { data: dbEvents   },
      { data: members    },
      { data: health     },
      { data: cars       },
      { data: contracts  },
    ] = await Promise.all([
      db.from('family_events')
        .select('*, family_members(name,color)')
        .gte('date', fromStr)
        .lte('date', toStr),

      db.from('family_members')
        .select('*'),

      db.from('health_records')
        .select('*, family_members(name,color)')
        .not('next_date', 'is', null),

      db.from('cars')
        .select('name,stk_date,insurance_date'),

      db.from('contracts')
        .select('name,end_date,notice_period_days,type'),
    ]);

    // ── Sestavení eventMap ─────────────────────────
    const eventMap = {};

    // 1. Události z family_events
    (dbEvents ?? []).forEach(ev => {
      if (!ev.date) return;
      addEvent(eventMap, ev.date, {
        title:  ev.title,
        type:   ev.type ?? 'jiné',
        color:  eventColor(ev.type ?? 'jiné'),
        notes:  ev.notes,
        source: 'event',
        raw:    ev,
      });
    });

    // 2. Narozeniny + jmeniny členů rodiny
    (members ?? []).forEach(member => {
      if (!member.name) return;
      const fn = firstName(member.name);
      const memberColor = member.color ?? eventColor('narozeniny');

      // Narozeniny — hledáme birthdate ve formátu YYYY-MM-DD
      if (member.birthdate) {
        const bParts = member.birthdate.split('-');
        if (bParts.length === 3) {
          const bKey = `${currentYear}-${bParts[1]}-${bParts[2]}`;
          addEvent(eventMap, bKey, {
            title:  `🎂 Narozeniny — ${member.name}`,
            type:   'narozeniny',
            color:  memberColor,
            notes:  '',
            source: 'birthday',
          });
        }
      }

      // Jmeniny
      const nameDayDate = findNameDay(fn, currentYear);
      if (nameDayDate) {
        addEvent(eventMap, nameDayDate, {
          title:  `🌸 Jmeniny — ${fn}`,
          type:   'jmeniny',
          color:  eventColor('jmeniny'),
          notes:  '',
          source: 'nameday',
        });
      }
    });

    // 3. Zdravotní záznamy (next_date)
    (health ?? []).forEach(rec => {
      if (!rec.next_date) return;
      const memberName = rec.family_members?.name ?? '';
      const memberColor = rec.family_members?.color ?? eventColor('zdraví');
      addEvent(eventMap, rec.next_date, {
        title:  `🏥 ${rec.type ?? 'Lékař'}${memberName ? ' — ' + memberName : ''}`,
        type:   'zdraví',
        color:  memberColor,
        notes:  rec.notes ?? '',
        source: 'health',
      });
    });

    // 4. Auta — STK a pojištění
    (cars ?? []).forEach(car => {
      if (car.stk_date) {
        addEvent(eventMap, car.stk_date, {
          title:  `🔧 STK — ${car.name}`,
          type:   'stk',
          color:  eventColor('stk'),
          notes:  '',
          source: 'car',
        });
      }
      if (car.insurance_date) {
        addEvent(eventMap, car.insurance_date, {
          title:  `🛡️ Pojištění — ${car.name}`,
          type:   'pojisteni',
          color:  eventColor('pojisteni'),
          notes:  '',
          source: 'car',
        });
      }
    });

    // 5. Smlouvy — datum konce / výpovědi
    (contracts ?? []).forEach(c => {
      if (!c.end_date) return;
      // Datum výpovědi = end_date − notice_period_days
      if (c.notice_period_days) {
        const noticeDate = new Date(c.end_date + 'T00:00:00');
        noticeDate.setDate(noticeDate.getDate() - c.notice_period_days);
        const noticeKey = dateKey(noticeDate);
        addEvent(eventMap, noticeKey, {
          title:  `⚠️ Výpověď — ${c.name}`,
          type:   'smlouva',
          color:  eventColor('smlouva'),
          notes:  `Konec smlouvy: ${App.formatDate(c.end_date)}`,
          source: 'contract',
        });
      }
      addEvent(eventMap, c.end_date, {
        title:  `📄 Konec smlouvy — ${c.name}`,
        type:   'smlouva',
        color:  eventColor('smlouva'),
        notes:  c.type ?? '',
        source: 'contract',
      });
    });

    // 6. Státní svátky a zvláštní dny
    SPECIAL_DAYS.forEach(sd => {
      const key = `${currentYear}-${sd.date}`;
      addEvent(eventMap, key, {
        title:  sd.title,
        type:   sd.type,
        color:  eventColor(sd.type),
        notes:  '',
        source: 'special',
      });
    });

    // 7. Den matek — druhá neděle v květnu
    const mDay = mothersDay(currentYear);
    if (mDay) {
      addEvent(eventMap, dateKey(mDay), {
        title:  '💐 Den matek',
        type:   'svátek',
        color:  eventColor('svátek'),
        notes:  '',
        source: 'special',
      });
    }

    // ── Vykreslení mřížky ──────────────────────────
    renderGrid(container, eventMap);
  }

  // ── renderGrid() ───────────────────────────────
  function renderGrid(container, eventMap) {
    const todayKey = dateKey(new Date());

    // Výpočet první buňky mřížky
    // Pondělí = 0 … Neděle = 6 (evropský styl)
    const firstOfMonth = new Date(currentYear, currentMonth, 1);
    const lastOfMonth  = new Date(currentYear, currentMonth + 1, 0);

    // getDay(): 0=ne,1=po,...,6=so → převod na po=0..ne=6
    function isoWeekday(d) {
      return (d.getDay() + 6) % 7;
    }

    const startOffset = isoWeekday(firstOfMonth); // 0–6, kolik prázdných buněk před 1.

    // Záhlaví dnů
    const dayHeaders = ['Po', 'Út', 'St', 'Čt', 'Pá', 'So', 'Ne'];

    let html = '<div class="kal-grid">';

    // Záhlaví
    dayHeaders.forEach(d => {
      html += `<div class="kal-header-cell">${d}</div>`;
    });

    // Buňky předchozího měsíce (dimmed)
    const prevMonthLastDay = new Date(currentYear, currentMonth, 0);
    for (let i = startOffset - 1; i >= 0; i--) {
      const day = prevMonthLastDay.getDate() - i;
      html += renderCell(new Date(currentYear, currentMonth - 1, day), eventMap, todayKey, true);
    }

    // Buňky aktuálního měsíce
    for (let d = 1; d <= lastOfMonth.getDate(); d++) {
      html += renderCell(new Date(currentYear, currentMonth, d), eventMap, todayKey, false);
    }

    // Doplnění buněk příštího měsíce
    const totalCells = startOffset + lastOfMonth.getDate();
    const remainingCells = (7 - (totalCells % 7)) % 7;
    for (let d = 1; d <= remainingCells; d++) {
      html += renderCell(new Date(currentYear, currentMonth + 1, d), eventMap, todayKey, true);
    }

    html += '</div>';

    // Vložení stylů (pokud ještě nejsou)
    injectStyles();

    container.innerHTML = html;

    // Přidání click handlerů — všechny buňky jsou klikatelné
    container.querySelectorAll('.kal-cell[data-date]').forEach(cell => {
      cell.addEventListener('click', () => {
        openDayModal(cell.dataset.date, eventMap[cell.dataset.date] ?? []);
      });
    });
  }

  function renderCell(date, eventMap, todayKey, otherMonth) {
    const key      = dateKey(date);
    const events   = eventMap[key] ?? [];
    const isToday  = key === todayKey;
    const dayNum   = date.getDate();

    const mmdd        = key.slice(5);
    const nameDayName = NAME_DAYS[mmdd] ?? '';

    let classes = 'kal-cell';
    if (isToday)        classes += ' kal-today';
    if (otherMonth)     classes += ' kal-other-month';
    if (events.length > 0) classes += ' kal-has-events';

    // Labely událostí — zobrazit max 3, pak "+N dalších"
    let eventsHtml = '';
    if (events.length > 0) {
      const shown = events.slice(0, 3);
      eventsHtml = '<div class="kal-events">';
      shown.forEach(ev => {
        eventsHtml += `<div class="kal-event-pill" style="border-left:2px solid ${esc(ev.color)};background:${esc(ev.color)}18" title="${esc(ev.title)}">
          <span class="kal-event-pill-dot" style="background:${esc(ev.color)}"></span>
          <span class="kal-event-pill-text">${esc(ev.title)}</span>
        </div>`;
      });
      if (events.length > 3) {
        eventsHtml += `<div class="kal-event-more">+${events.length - 3}</div>`;
      }
      eventsHtml += '</div>';
    }

    return `<div class="${classes}" data-date="${key}">
      <div class="kal-cell-head">
        <span class="kal-day-num">${dayNum}</span>
        ${nameDayName ? `<span class="kal-name-day">${esc(nameDayName)}</span>` : ''}
      </div>
      ${eventsHtml}
    </div>`;
  }

  // ── Modal pro den ──────────────────────────────
  function openDayModal(dk, events) {
    const d = new Date(dk + 'T00:00:00');
    const dateStr = d.toLocaleDateString('cs-CZ', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });

    const mmdd = dk.slice(5);
    const nameDay = NAME_DAYS[mmdd];

    const titleHtml = `📅 ${esc(dateStr)}`;

    let bodyHtml = '';
    if (nameDay) {
      bodyHtml += `<div class="kal-modal-nameday">🌸 Svátek má: <strong>${esc(nameDay)}</strong></div>`;
    }

    if (events.length > 0) {
      bodyHtml += '<div class="kal-modal-events">';
      events.forEach(ev => {
        bodyHtml += `
          <div class="kal-modal-event-item" style="display:flex;align-items:flex-start;gap:.5rem">
            <div class="kal-modal-event-dot" style="background:${esc(ev.color)};margin-top:.3rem"></div>
            <div class="kal-modal-event-body" style="flex:1;min-width:0">
              <div class="kal-modal-event-title">${esc(ev.title)}</div>
              ${ev.notes ? `<div class="kal-modal-event-notes">${esc(ev.notes)}</div>` : ''}
              <div class="kal-modal-event-type">${esc(getTypeLabel(ev.type))}</div>
            </div>
            ${ev.id ? `<button class="btn btn-icon btn-ghost btn-sm" title="Smazat událost"
              onclick="Kalendar.deleteEvent('${ev.id}','${esc(dk)}')" style="flex-shrink:0;color:var(--danger);opacity:.7"
              onmouseover="this.style.opacity=1" onmouseout="this.style.opacity=.7">🗑️</button>` : ''}
          </div>`;
      });
      bodyHtml += '</div>';
    } else {
      bodyHtml += `<div style="color:var(--text-muted);font-size:.875rem;padding:.5rem 0">Žádné události.</div>`;
    }

    bodyHtml += `<div style="margin-top:1rem;padding-top:.75rem;border-top:1px solid var(--border)">
      <button class="btn btn-primary btn-sm" onclick="App.closeModal();Kalendar.openAddForDate('${esc(dk)}')">+ Přidat událost</button>
    </div>`;

    App.openModal(titleHtml, bodyHtml);
  }

  // ── Přidat událost pro konkrétní datum ─────────
  const EVENT_TYPES = [
    { value: 'jiné',          label: '📌 Jiné' },
    { value: 'narozeniny',    label: '🎂 Narozeniny' },
    { value: 'výročí',        label: '💍 Výročí' },
    { value: 'výročí-svatby', label: '💒 Výročí svatby' },
    { value: 'lékař',         label: '🏥 Lékař' },
    { value: 'kroužek',       label: '⚽ Kroužek' },
    { value: 'škola',         label: '🎒 Škola' },
    { value: 'dovolená',      label: '✈️ Dovolená' },
  ];

  function openAddForDate(prefillDate) {
    App.openModal('📅 Nová událost', `
      <div class="form-group">
        <label class="form-label">Název *</label>
        <input id="kal-ev-title" class="form-control" placeholder="např. Narozeniny Pavla">
      </div>
      <div class="form-row">
        <div class="form-group">
          <label class="form-label">Datum *</label>
          <input id="kal-ev-date" type="date" class="form-control" value="${esc(prefillDate)}">
        </div>
        <div class="form-group">
          <label class="form-label">Typ</label>
          <select id="kal-ev-type" class="form-control">
            ${EVENT_TYPES.map(t => `<option value="${t.value}">${t.label}</option>`).join('')}
          </select>
        </div>
      </div>
      <div class="form-group">
        <label class="form-label" style="display:flex;align-items:center;gap:.5rem;cursor:pointer">
          <input type="checkbox" id="kal-ev-recurring"> Opakuje se každý rok
        </label>
      </div>
      <div class="form-group">
        <label class="form-label">Poznámka</label>
        <input id="kal-ev-notes" class="form-control" placeholder="Volitelně…">
      </div>
    `, {
      saveLabel: 'Přidat událost',
      onSave: async () => {
        const title = document.getElementById('kal-ev-title')?.value.trim();
        const date  = document.getElementById('kal-ev-date')?.value;
        if (!title || !date) { App.toast('Vyplňte název a datum.', 'error'); return; }
        const { error } = await db.from('family_events').insert({
          title, date,
          type:      document.getElementById('kal-ev-type')?.value ?? 'jiné',
          recurring: document.getElementById('kal-ev-recurring')?.checked ?? false,
          notes:     document.getElementById('kal-ev-notes')?.value.trim() || null,
        });
        if (error) { App.toast('Chyba: ' + error.message, 'error'); return; }
        App.toast('Událost přidána ✓', 'success');
        App.closeModal();
        buildCalendar();
      }
    });
  }

  function getTypeLabel(type) {
    const map = {
      narozeniny:      '🎂 Narozeniny',
      jmeniny:         '🌸 Jmeniny',
      'výročí-svatby': '💒 Výročí svatby',
      výročí:          '💍 Výročí',
      zdraví:          '🏥 Zdraví',
      lékař:           '🏥 Lékař',
      kroužek:         '⚽ Kroužek',
      škola:           '🎒 Škola',
      dovolená:        '✈️ Dovolená',
      stk:             '🔧 STK',
      pojisteni:       '🛡️ Pojištění',
      smlouva:         '📄 Smlouva',
      svátek:          '🗓️ Svátek',
      jiné:            '📌 Jiné',
    };
    return map[type] ?? type;
  }

  // ── CSS injekce ────────────────────────────────
  let _stylesInjected = false;
  function injectStyles() {
    if (_stylesInjected) return;
    _stylesInjected = true;

    const style = document.createElement('style');
    style.textContent = `
      /* ── Kalendář ── */
      .kal-loading {
        padding: 2rem;
        text-align: center;
        color: var(--text-muted, #94a3b8);
        font-size: 0.9rem;
      }

      .kal-grid {
        display: grid;
        grid-template-columns: repeat(7, 1fr);
        gap: 2px;
        background: var(--border, #e2e8f0);
        border: 1px solid var(--border, #e2e8f0);
        border-radius: 0.75rem;
        overflow: hidden;
      }

      .kal-header-cell {
        background: var(--surface, #f8fafc);
        padding: 0.5rem 0.25rem;
        text-align: center;
        font-size: 0.75rem;
        font-weight: 600;
        color: var(--text-muted, #64748b);
        text-transform: uppercase;
        letter-spacing: 0.05em;
      }

      .kal-cell {
        background: var(--card-bg, #ffffff);
        min-height: 90px;
        padding: 0.4rem;
        cursor: default;
        transition: background 0.15s;
        display: flex;
        flex-direction: column;
        gap: 3px;
        position: relative;
      }

      .kal-cell { cursor: pointer; }
      .kal-cell:hover { background: #f8faff; }
      .kal-cell.kal-today:hover { background: #e0e7ff; }

      .kal-cell.kal-today { background: #eef2ff; }
      .kal-cell.kal-today .kal-day-num {
        background: var(--primary, #6366f1);
        color: #fff;
        border-radius: 50%;
        width: 22px; height: 22px;
        display: inline-flex; align-items: center; justify-content: center;
        font-size: 0.8rem;
        font-weight: 700;
      }
      .kal-cell.kal-today .kal-name-day { color: var(--primary, #6366f1); }

      .kal-cell.kal-other-month { background: var(--surface2, #f8fafc); opacity: 0.55; }

      .kal-cell-head {
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 2px;
        flex-shrink: 0;
        min-height: 22px;
      }

      .kal-day-num {
        font-size: 0.8rem;
        font-weight: 600;
        color: var(--text, #1e293b);
        line-height: 1;
        flex-shrink: 0;
      }

      .kal-name-day {
        font-size: 0.6rem;
        color: var(--text-muted, #94a3b8);
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
        text-align: right;
        flex: 1;
        min-width: 0;
        line-height: 1.2;
      }

      .kal-events {
        display: flex;
        flex-direction: column;
        gap: 2px;
        flex: 1;
        overflow: hidden;
      }

      .kal-event-pill {
        display: flex;
        align-items: center;
        gap: 4px;
        padding: 1px 4px;
        border-radius: 3px;
        overflow: hidden;
        white-space: nowrap;
        line-height: 1.4;
      }

      .kal-event-pill-dot {
        width: 5px; height: 5px;
        border-radius: 50%;
        flex-shrink: 0;
      }

      .kal-event-pill-text {
        font-size: 0.65rem;
        font-weight: 500;
        color: var(--text, #1e293b);
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
      }

      .kal-event-more {
        font-size: 0.6rem;
        color: var(--text-muted, #94a3b8);
        padding-left: 4px;
      }

      /* ── Modální okno — den ── */
      .kal-modal-nameday {
        background: var(--surface, #f8fafc);
        border-radius: 0.5rem;
        padding: 0.5rem 0.75rem;
        font-size: 0.875rem;
        color: var(--text-muted, #64748b);
        margin-bottom: 1rem;
      }

      .kal-modal-events {
        display: flex;
        flex-direction: column;
        gap: 0.625rem;
      }

      .kal-modal-event-item {
        display: flex;
        align-items: flex-start;
        gap: 0.625rem;
        padding: 0.625rem 0.75rem;
        background: var(--surface, #f8fafc);
        border-radius: 0.5rem;
        border: 1px solid var(--border, #e2e8f0);
      }

      .kal-modal-event-dot {
        width: 10px;
        height: 10px;
        border-radius: 50%;
        flex-shrink: 0;
        margin-top: 3px;
      }

      .kal-modal-event-body {
        flex: 1;
        min-width: 0;
      }

      .kal-modal-event-title {
        font-size: 0.9rem;
        font-weight: 600;
        color: var(--text, #1e293b);
        line-height: 1.3;
      }

      .kal-modal-event-notes {
        font-size: 0.8rem;
        color: var(--text-muted, #64748b);
        margin-top: 2px;
      }

      .kal-modal-event-type {
        font-size: 0.75rem;
        color: var(--text-muted, #94a3b8);
        margin-top: 3px;
      }

      /* Responzivita */
      @media (max-width: 640px) {
        .kal-cell { min-height: 56px; padding: 0.25rem; }
        .kal-name-day { display: none; }
        .kal-event-pill-text { display: none; }
        .kal-event-pill {
          padding: 2px;
          border-radius: 50%;
          width: 8px; height: 8px;
          border-left: none !important;
          background: none !important;
          flex-shrink: 0;
        }
        .kal-event-pill-dot { width: 7px; height: 7px; }
        .kal-events { flex-direction: row; flex-wrap: wrap; gap: 2px; align-items: flex-start; }
        .kal-event-more { font-size: 0.55rem; }
      }
    `;
    document.head.appendChild(style);
  }

  function goToday() {
    const now = new Date();
    currentYear  = now.getFullYear();
    currentMonth = now.getMonth();
    updateLabel();
    buildCalendar();
  }

  // ── Smazat událost ─────────────────────────────
  async function deleteEvent(id, dk) {
    if (!confirm('Opravdu smazat tuto událost?')) return;
    const { error } = await db.from('family_events').delete().eq('id', id);
    if (error) { App.toast('Chyba: ' + error.message, 'error'); return; }
    App.toast('Událost smazána ✓', 'success');
    App.closeModal();
    buildCalendar();
  }

  // ── Public API ─────────────────────────────────
  return { load, goToday, openAddForDate, deleteEvent };

})();

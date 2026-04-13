/* ═══════════════════════════════════════════════
   Home OS — Centrum notifikací
   Agreguje všechna časově citlivá upozornění.
   ═══════════════════════════════════════════════ */

const Notifikace = (() => {

  function dateKey(d) {
    return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
  }

  async function load() {
    const el = document.getElementById('notif-content');
    if (!el) return;
    el.innerHTML = '<div class="loading"><div class="spinner"></div> Načítám…</div>';

    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const todayStr = dateKey(today);
    const currYear = today.getFullYear();

    const [
      { data: cars },
      { data: contracts },
      { data: health },
      { data: members },
      { data: events },
    ] = await Promise.all([
      db.from('cars').select('id,name,stk_date,insurance_date'),
      db.from('contracts').select('id,name,type,end_date,notice_period_days'),
      db.from('health_records').select('id,title,type,next_date,member_id,family_members(name,color)').not('next_date','is',null),
      db.from('family_members').select('id,name,birthdate,color'),
      db.from('family_events').select('id,title,date,type,recurring').eq('recurring', true),
    ]);

    const notifications = [];

    // ── Auta: STK a pojištění ──────────────────
    (cars ?? []).forEach(car => {
      if (car.stk_date) notifications.push({
        id: `stk-${car.id}`,
        icon: '🔧', title: `STK — ${car.name}`,
        date: car.stk_date, type: 'auto',
        action: () => App.navigateTo('auto'),
        actionLabel: '→ Auto',
      });
      if (car.insurance_date) notifications.push({
        id: `ins-${car.id}`,
        icon: '🛡️', title: `Pojištění — ${car.name}`,
        date: car.insurance_date, type: 'auto',
        action: () => App.navigateTo('auto'),
        actionLabel: '→ Auto',
      });
    });

    // ── Smlouvy: datum výpovědi ────────────────
    (contracts ?? []).forEach(c => {
      if (!c.end_date) return;
      const notice = c.notice_period_days ?? 30;
      const noticeDate = new Date(c.end_date + 'T00:00:00');
      noticeDate.setDate(noticeDate.getDate() - notice);
      const noticeDateStr = dateKey(noticeDate);
      notifications.push({
        id: `contract-${c.id}`,
        icon: '📋', title: `Výpověď — ${c.name}`,
        date: noticeDateStr, type: 'smlouva',
        sub: `Konec smlouvy: ${App.formatDate(c.end_date)}`,
        action: () => App.navigateTo('smlouvy'),
        actionLabel: '→ Smlouvy',
      });
    });

    // ── Zdraví: příští termíny ─────────────────
    (health ?? []).forEach(r => {
      if (!r.next_date) return;
      const memberName = r.family_members?.name;
      notifications.push({
        id: `health-${r.id}`,
        icon: '🏥', title: `${r.title}${memberName ? ' — ' + memberName : ''}`,
        date: r.next_date, type: 'zdraví',
        action: () => App.navigateTo('zdravi'),
        actionLabel: '→ Zdraví',
      });
    });

    // ── Narozeniny ────────────────────────────
    (members ?? []).forEach(m => {
      if (!m.birthdate) return;
      const mmdd = m.birthdate.slice(5);
      for (const yr of [currYear, currYear + 1]) {
        const candidate = `${yr}-${mmdd}`;
        if (candidate >= todayStr) {
          notifications.push({
            id: `bday-${m.id}`,
            icon: '🎂', title: `Narozeniny — ${m.name}`,
            date: candidate, type: 'rodina',
            action: () => App.navigateTo('rodina'),
            actionLabel: '→ Rodina',
          });
          break;
        }
      }
    });

    // ── Rekurentní události ───────────────────
    (events ?? []).forEach(ev => {
      if (!ev.date) return;
      const mmdd = ev.date.slice(5);
      for (const yr of [currYear, currYear + 1]) {
        const candidate = `${yr}-${mmdd}`;
        if (candidate >= todayStr) {
          notifications.push({
            id: `event-${ev.id}`,
            icon: '📅', title: ev.title,
            date: candidate, type: 'událost',
            action: () => App.navigateTo('kalendar'),
            actionLabel: '→ Kalendář',
          });
          break;
        }
      }
    });

    // ── Seřadit a filtrovat ───────────────────
    notifications.sort((a, b) => a.date.localeCompare(b.date));
    const relevant = notifications.filter(n => App.daysUntil(n.date) >= -30);

    renderAll(el, relevant);
  }

  function renderAll(el, notifs) {
    if (!notifs.length) {
      el.innerHTML = `<div class="empty-state">
        <div class="empty-icon">✅</div>
        <div class="empty-title">Vše v pořádku</div>
        <div class="empty-text">Žádné blížící se termíny ani lhůty.</div>
      </div>`;
      return;
    }

    const overdue  = notifs.filter(n => App.daysUntil(n.date) < 0);
    const thisWeek = notifs.filter(n => { const d = App.daysUntil(n.date); return d >= 0 && d <= 7; });
    const thisMonth= notifs.filter(n => { const d = App.daysUntil(n.date); return d > 7 && d <= 30; });
    const later    = notifs.filter(n => App.daysUntil(n.date) > 30);

    let html = '';
    if (overdue.length)   html += renderGroup('🚨 Po lhůtě', overdue,   'var(--danger)',  '#fff1f1');
    if (thisWeek.length)  html += renderGroup('⚡ Tento týden', thisWeek, 'var(--warning)', '#fffbeb');
    if (thisMonth.length) html += renderGroup('📅 Tento měsíc', thisMonth,'var(--info)',    '#eff6ff');
    if (later.length)     html += renderGroup('🗓️ Dál v budoucnu', later, 'var(--text-muted)', 'var(--surface2)');

    el.innerHTML = html;
  }

  function renderGroup(title, items, accentColor, bgColor) {
    return `
      <div style="margin-bottom:1.5rem">
        <div style="font-size:.75rem;font-weight:700;text-transform:uppercase;letter-spacing:.07em;color:${accentColor};margin-bottom:.625rem">${title}</div>
        <div style="display:flex;flex-direction:column;gap:.375rem">
          ${items.map(n => renderItem(n, accentColor, bgColor)).join('')}
        </div>
      </div>`;
  }

  function renderItem(n, accentColor, bgColor) {
    const days = App.daysUntil(n.date);
    return `<div style="display:flex;align-items:center;gap:.75rem;padding:.625rem .875rem;background:${bgColor};border-radius:8px;border-left:3px solid ${accentColor}">
      <span style="font-size:1.2rem;flex-shrink:0">${n.icon}</span>
      <div style="flex:1;min-width:0">
        <div style="font-size:.9rem;font-weight:600;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${App.esc(n.title)}</div>
        <div style="font-size:.78rem;color:var(--text-muted);margin-top:1px">
          ${App.formatDate(n.date)}${n.sub ? ' · ' + App.esc(n.sub) : ''}
        </div>
      </div>
      <div style="display:flex;align-items:center;gap:.5rem;flex-shrink:0">
        ${App.countdownBadge(days)}
      </div>
    </div>`;
  }

  return { load };
})();

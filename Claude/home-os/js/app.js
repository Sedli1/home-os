/* ═══════════════════════════════════════════════
   Home OS — navigace, init, helpers
   ═══════════════════════════════════════════════ */

const App = (() => {
  let activePage = 'dashboard';

  function init(user) {
    // User info v sidebaru
    const email = user?.email ?? '';
    document.getElementById('userEmail').textContent = email;
    document.getElementById('userAvatar').textContent = Auth.getInitials(email);

    // Navigace
    document.querySelectorAll('.nav-link[data-page]').forEach(link => {
      link.addEventListener('click', () => {
        navigateTo(link.dataset.page);
        closeMobileMenu();
      });
    });

    // Hamburger (mobil)
    document.getElementById('hamburgerBtn')?.addEventListener('click', openMobileMenu);
    document.getElementById('navOverlay')?.addEventListener('click', closeMobileMenu);

    // Search keyboard shortcut
    document.addEventListener('keydown', (e) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'k') { e.preventDefault(); openSearch(); }
      if (e.key === 'Escape') closeSearch();
    });
    // Search input debounce
    document.getElementById('searchInput')?.addEventListener('input', (e) => {
      clearTimeout(_searchTimer);
      _searchTimer = setTimeout(() => performSearch(e.target.value.trim()), 250);
    });

    // Logout
    document.getElementById('logoutBtn')?.addEventListener('click', async () => {
      await Auth.logout();
    });

    // Hash routing
    const hash = location.hash.replace('#', '') || 'dashboard';
    navigateTo(hash);

    // Dashboard načíst po init
    loadDashboard();

    // Widgety
    _applyWidgetOrder();
    _applyWidgetVisibility();
    _initWidgetDragDrop();

    // PIN lock
    if (typeof PinLock !== 'undefined') PinLock.init();
  }

  function navigateTo(page) {
    const pages = ['dashboard', 'rodina', 'zdravi', 'finance', 'pronajem', 'auto', 'smlouvy', 'kalendar', 'notifikace', 'domacnost', 'todo', 'reporty'];
    if (!pages.includes(page)) page = 'dashboard';

    document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
    document.querySelectorAll('.nav-link').forEach(l => l.classList.remove('active'));

    document.getElementById(`page-${page}`)?.classList.add('active');
    document.querySelector(`.nav-link[data-page="${page}"]`)?.classList.add('active');

    location.hash = page;
    activePage = page;

    // Načíst data pro stránku
    switch (page) {
      case 'dashboard':  loadDashboard(); break;
      case 'rodina':     Rodina.load(); break;
      case 'finance':    Finance.load(); break;
      case 'pronajem':   Pronajem.load(); break;
      case 'auto':       Auto.load(); break;
      case 'domacnost':  navigateTo('smlouvy'); return;
      case 'zdravi':     Zdravi.load(); break;
      case 'smlouvy':    Smlouvy.load(); break;
      case 'kalendar':   Kalendar.load(); break;
      case 'notifikace': navigateTo('kalendar'); return;
      case 'todo':       Todo.load(); break;
      case 'reporty':    navigateTo('finance'); return;
    }
  }

  function openMobileMenu() {
    document.getElementById('sidebar').classList.add('open');
    document.getElementById('navOverlay').classList.add('visible');
  }

  function closeMobileMenu() {
    document.getElementById('sidebar').classList.remove('open');
    document.getElementById('navOverlay').classList.remove('visible');
  }

  async function loadDashboard() {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const todayStr = today.toISOString().split('T')[0];
    const in60     = new Date(today.getTime() + 60 * 86400000).toISOString().split('T')[0];
    const currYear = today.getFullYear();

    // Finance + upcoming in parallel
    const monthStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}`;
    const [
      { data: txs },
      { data: regularEvents },
      { data: recurringEvents },
      { data: members },
      { data: cars },
      { data: contracts },
      { data: healthRecs },
    ] = await Promise.all([
      db.from('finance_transactions').select('amount,type').gte('date', `${monthStr}-01`).lte('date', `${monthStr}-31`),
      db.from('family_events').select('id,title,date,type').gte('date', todayStr).lte('date', in60).order('date').limit(30),
      db.from('family_events').select('id,title,date,type').eq('recurring', true),
      db.from('family_members').select('id,name,birthdate,color'),
      db.from('cars').select('name,stk_date,insurance_date'),
      db.from('contracts').select('name,end_date,notice_period_days').not('end_date','is',null),
      db.from('health_records').select('id,title,type,next_date,family_members(name)').not('next_date','is',null).gte('next_date', todayStr).lte('next_date', in60),
    ]);

    // Finance KPIs
    let income = 0, expense = 0;
    (txs ?? []).forEach(t => {
      if (t.type === 'příjem') income += parseFloat(t.amount);
      else expense += parseFloat(t.amount);
    });
    document.getElementById('dashIncome').textContent  = formatMoney(income);
    document.getElementById('dashExpense').textContent = formatMoney(expense);
    document.getElementById('dashBalance').textContent = formatMoney(income - expense);
    document.getElementById('dashBalanceCard').className =
      `kpi-card ${income - expense >= 0 ? '' : 'kpi-negative'}`;

    // Build upcoming list
    const items = [...(regularEvents ?? [])];
    const seenIds = new Set(items.map(e => String(e.id)));

    (recurringEvents ?? []).forEach(ev => {
      if (!ev.date || seenIds.has(String(ev.id))) return;
      const mmdd = ev.date.slice(5);
      for (const yr of [currYear, currYear + 1]) {
        const c = `${yr}-${mmdd}`;
        if (c >= todayStr && c <= in60) { items.push({ ...ev, date: c }); break; }
      }
    });

    (members ?? []).forEach(m => {
      if (!m.birthdate) return;
      const mmdd = m.birthdate.slice(5);
      for (const yr of [currYear, currYear + 1]) {
        const c = `${yr}-${mmdd}`;
        if (c >= todayStr && c <= in60) {
          items.push({ id: `bday-${m.id}`, title: `Narozeniny — ${m.name}`, date: c, type: 'narozeniny' });
          break;
        }
      }
    });

    (cars ?? []).forEach(car => {
      if (car.stk_date && car.stk_date >= todayStr && car.stk_date <= in60)
        items.push({ id: `stk-${car.name}`, title: `STK — ${car.name}`, date: car.stk_date, type: 'stk' });
      if (car.insurance_date && car.insurance_date >= todayStr && car.insurance_date <= in60)
        items.push({ id: `ins-${car.name}`, title: `Pojištění — ${car.name}`, date: car.insurance_date, type: 'auto' });
    });

    (contracts ?? []).forEach(c => {
      if (!c.end_date) return;
      const noticeDays = c.notice_period_days ?? 30;
      const noticeDate = new Date(c.end_date + 'T00:00:00');
      noticeDate.setDate(noticeDate.getDate() - noticeDays);
      const noticeStr = noticeDate.toISOString().split('T')[0];
      if (noticeStr >= todayStr && noticeStr <= in60)
        items.push({ id: `con-${c.name}`, title: `Výpověď — ${c.name}`, date: noticeStr, type: 'smlouva' });
    });

    (healthRecs ?? []).forEach(r => {
      const memberName = r.family_members?.name ? ` — ${r.family_members.name}` : '';
      items.push({ id: `hlth-${r.id}`, title: `${r.title || r.type}${memberName}`, date: r.next_date, type: 'lékař' });
    });

    items.sort((a, b) => a.date.localeCompare(b.date));
    renderDashUpcoming(items.slice(0, 8));

    // Smlouvy k výpovědi
    loadDashContracts(contracts ?? []);

    // Check-in widget
    loadDashCheckin();
  }

  function loadDashCheckin() {
    const el = document.getElementById('dashCheckin');
    if (!el || typeof Todo === 'undefined') return;

    const s = Todo.getDashStatus();
    const hour = new Date().getHours();
    const isEvening = hour >= 13;

    const streakHtml = s.streak >= 2
      ? `<span style="font-size:.8rem;font-weight:700;color:#10b981">🔥 ${s.streak} dní</span>` : '';

    const staleWarn = s.stalest >= 3
      ? `<div style="font-size:.78rem;color:#ef4444;margin-top:.375rem">⚠️ Máš úkol, který přenášíš ${s.stalest + 1} dní!</div>` : '';

    let statusHtml, actionHtml;

    if (!s.hasMorning) {
      const rolledCount = (() => {
        try {
          const j = JSON.parse(localStorage.getItem('hpos_work_journal') ?? '{}');
          const yk = new Date(new Date() - 86400000).toISOString().split('T')[0];
          const y = j[yk];
          if (!y?.morning || !y?.evening) return 0;
          return y.morning.tasks.filter((_, i) => !y.evening.done.includes(i)).length;
        } catch { return 0; }
      })();
      statusHtml = `<div style="font-size:.875rem;color:var(--text-muted)">☀️ Ranní plán ještě nezadán${rolledCount > 0 ? ` · <span style="color:#f59e0b">📬 ${rolledCount} z včerejška</span>` : ''}</div>`;
      actionHtml = `<button class="btn btn-sm btn-primary" onclick="App.navigateTo('todo');setTimeout(()=>document.querySelector('#page-todo .tab-btn[data-tab=checkin]')?.click(),300)">Zahájit ranní check-in →</button>`;
    } else if (!s.hasEvening) {
      const pctBar = `<div style="height:5px;border-radius:99px;background:var(--surface2);margin-top:.375rem"><div style="height:100%;width:0%;background:#6366f1;border-radius:99px"></div></div>`;
      statusHtml = `<div style="font-size:.875rem">📋 Plán aktivní — <strong>${s.tasks}</strong> úkolů${isEvening ? ' · <span style="color:#f59e0b">čas na večerní check-in</span>' : ''}</div>${pctBar}`;
      actionHtml = isEvening
        ? `<button class="btn btn-sm btn-primary" onclick="App.navigateTo('todo');setTimeout(()=>{document.querySelector('#page-todo .tab-btn[data-tab=checkin]')?.click();setTimeout(()=>Todo._forceEvening(),300)},300)">🌙 Zadat výsledky dne →</button>`
        : `<button class="btn btn-sm btn-outline" onclick="App.navigateTo('todo');setTimeout(()=>document.querySelector('#page-todo .tab-btn[data-tab=checkin]')?.click(),300)">Zobrazit plán</button>`;
    } else {
      const color = s.pct >= 80 ? '#10b981' : s.pct >= 50 ? '#f59e0b' : '#ef4444';
      statusHtml = `<div style="font-size:.875rem">✅ Dnes splněno <strong style="color:${color}">${s.pct}%</strong> · ${s.done}/${s.tasks} úkolů</div>
        <div style="height:5px;border-radius:99px;background:var(--surface2);margin-top:.375rem"><div style="height:100%;width:${s.pct}%;background:${color};border-radius:99px"></div></div>`;
      actionHtml = `<button class="btn btn-sm btn-outline" onclick="App.navigateTo('todo');setTimeout(()=>document.querySelector('#page-todo .tab-btn[data-tab=checkin]')?.click(),300)">Zobrazit detail</button>`;
    }

    el.innerHTML = `
      <div style="display:flex;justify-content:space-between;align-items:flex-start;gap:.5rem;margin-bottom:.625rem">
        <div style="flex:1">${statusHtml}${staleWarn}</div>
        ${streakHtml}
      </div>
      ${actionHtml}`;
  }

  function loadDashContracts(contracts) {
    const el = document.getElementById('dashContracts');
    if (!el) return;

    const today = new Date(); today.setHours(0,0,0,0);
    const todayStr = today.toISOString().split('T')[0];

    const items = contracts.map(c => {
      if (!c.end_date) return null;
      const noticeDays = c.notice_period_days ?? 30;
      const nd = new Date(c.end_date + 'T00:00:00');
      nd.setDate(nd.getDate() - noticeDays);
      const noticeStr = nd.toISOString().split('T')[0];
      return { ...c, noticeStr, daysToNotice: daysUntil(noticeStr) };
    }).filter(c => c && c.daysToNotice <= 90).sort((a, b) => a.daysToNotice - b.daysToNotice);

    if (!items.length) {
      el.innerHTML = '<div style="color:var(--text-muted);font-size:.875rem;padding:.5rem 0">Žádné smlouvy k výpovědi v příštích 90 dnech.</div>';
      return;
    }

    el.innerHTML = items.slice(0, 5).map(c => {
      const d = new Date(c.noticeStr + 'T00:00:00');
      return `<div class="event-item">
        <div class="event-date-box" style="background:#f59e0b20;color:#f59e0b">
          <span class="day">${d.getDate()}</span>
          <span class="mon">${d.toLocaleDateString('cs-CZ',{month:'short'})}</span>
        </div>
        <div class="event-body">
          <div class="event-title">${esc(c.name)}</div>
          <div class="event-meta">${c.daysToNotice < 0 ? `Lhůta vypršela před ${Math.abs(c.daysToNotice)} dny!` : c.daysToNotice === 0 ? 'Výpovědět dnes!' : `Výpovědět do ${formatDate(c.noticeStr)}`}</div>
        </div>
        ${countdownBadge(c.daysToNotice)}
      </div>`;
    }).join('');
  }

  function renderDashUpcoming(items) {
    const el = document.getElementById('dashUpcoming');
    if (!el) return;
    if (!items.length) {
      el.innerHTML = '<div style="color:var(--text-muted);font-size:.875rem;padding:.5rem 0">Příštích 30 dní bez událostí.</div>';
      return;
    }
    el.innerHTML = items.map(ev => {
      const d = new Date(ev.date + 'T00:00:00');
      const days = daysUntil(ev.date);
      return `<div class="event-item">
        <div class="event-date-box" style="background:${typeColor(ev.type)}20;color:${typeColor(ev.type)}">
          <span class="day">${d.getDate()}</span>
          <span class="mon">${d.toLocaleDateString('cs-CZ',{month:'short'})}</span>
        </div>
        <div class="event-body">
          <div class="event-title">${esc(ev.title)}</div>
          <div class="event-meta">${typeLabel(ev.type)}</div>
        </div>
        ${countdownBadge(days)}
      </div>`;
    }).join('');
  }

  // ── Helpers ──────────────────────────────────
  function formatMoney(n) {
    return new Intl.NumberFormat('cs-CZ', { style: 'currency', currency: 'CZK', maximumFractionDigits: 0 }).format(n);
  }

  function formatDate(str) {
    if (!str) return '—';
    return new Date(str + 'T00:00:00').toLocaleDateString('cs-CZ', { day: 'numeric', month: 'short', year: 'numeric' });
  }

  function daysUntil(dateStr) {
    const today = new Date(); today.setHours(0,0,0,0);
    const target = new Date(dateStr + 'T00:00:00');
    return Math.round((target - today) / 86400000);
  }

  function countdownBadge(days) {
    const cls = days < 0 ? 'alert' : days <= 30 ? 'warn' : 'ok';
    const txt = days < 0 ? `Před ${Math.abs(days)} dny` : days === 0 ? 'Dnes!' : `Za ${days} dní`;
    return `<span class="countdown ${cls}">${txt}</span>`;
  }

  function typeColor(type) {
    const map = {
      narozeniny: '#ec4899', výročí: '#8b5cf6', jmeniny: '#f472b6',
      'výročí-svatby': '#a78bfa', kroužek: '#3b82f6',
      lékař: '#ef4444', škola: '#f59e0b', dovolená: '#10b981', jiné: '#6366f1'
    };
    return map[type] ?? '#6366f1';
  }

  function typeLabel(type) {
    const map = {
      narozeniny: '🎂 Narozeniny', výročí: '💍 Výročí', jmeniny: '🌸 Jmeniny',
      'výročí-svatby': '💒 Výročí svatby', kroužek: '⚽ Kroužek',
      lékař: '🏥 Lékař', škola: '🎒 Škola', dovolená: '✈️ Dovolená', jiné: '📌 Jiné'
    };
    return map[type] ?? type;
  }

  function esc(str) {
    return String(str ?? '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
  }

  // ── Toast ─────────────────────────────────────
  function toast(msg, type = '') {
    const container = document.getElementById('toast-container');
    const el = document.createElement('div');
    el.className = `toast ${type}`;
    el.textContent = msg;
    container.appendChild(el);
    setTimeout(() => el.remove(), 3500);
  }

  // ── Modal ─────────────────────────────────────
  function openModal(titleHtml, bodyHtml, { onSave, saveLabel = 'Uložit', size = '' } = {}) {
    const overlay = document.getElementById('modal');
    overlay.querySelector('.modal-title').innerHTML = titleHtml;
    overlay.querySelector('.modal-body').innerHTML  = bodyHtml;
    overlay.querySelector('.modal').className       = `modal ${size}`;

    const saveBtn = overlay.querySelector('#modalSave');
    saveBtn.textContent = saveLabel;
    saveBtn.onclick = onSave ?? null;
    saveBtn.style.display = onSave ? '' : 'none';

    overlay.classList.add('open');
  }

  function closeModal() {
    document.getElementById('modal').classList.remove('open');
  }

  // ── Global search ──────────────────────────
  let _searchTimer;

  function openSearch() {
    document.getElementById('searchOverlay').classList.add('open');
    setTimeout(() => document.getElementById('searchInput')?.focus(), 50);
  }

  function closeSearch() {
    document.getElementById('searchOverlay').classList.remove('open');
    const inp = document.getElementById('searchInput');
    if (inp) inp.value = '';
    const res = document.getElementById('searchResults');
    if (res) res.innerHTML = '';
  }

  async function performSearch(query) {
    const res = document.getElementById('searchResults');
    if (!res) return;
    if (!query || query.length < 2) { res.innerHTML = ''; return; }

    res.innerHTML = '<div class="search-empty">Hledám…</div>';
    const q = `%${query}%`;

    const [mems, cars, contr, txs, health, shop, recurring, services, events, warranties] = await Promise.all([
      db.from('family_members').select('id,name,birthdate').ilike('name', q).limit(4),
      db.from('cars').select('id,name,plate').or(`name.ilike.${q},plate.ilike.${q}`).limit(4),
      db.from('contracts').select('id,name,provider').or(`name.ilike.${q},provider.ilike.${q}`).limit(4),
      db.from('finance_transactions').select('id,description,amount,date,type').ilike('description', q).limit(4),
      db.from('health_records').select('id,title,type,next_date').ilike('title', q).limit(4),
      db.from('shopping_list').select('id,item').ilike('item', q).eq('done', false).limit(3),
      db.from('recurring_transactions').select('id,name,amount,type').ilike('name', q).limit(3),
      db.from('car_services').select('id,description,date,cars(name)').ilike('description', q).limit(3),
      db.from('family_events').select('id,title,date,type').ilike('title', q).limit(3),
      db.from('warranties').select('id,name,store,warranty_end').ilike('name', q).limit(3),
    ]);

    const groups = [];
    if (mems.data?.length) groups.push({ label: '👨‍👩‍👧‍👦 Rodina', items: mems.data.map(m => ({ icon: '👤', title: m.name, sub: m.birthdate ? `Narozen/a ${formatDate(m.birthdate)}` : '', page: 'rodina' })) });
    if (events.data?.length) groups.push({ label: '📅 Události', items: events.data.map(e => ({ icon: '📅', title: e.title, sub: e.date ? formatDate(e.date) : '', page: 'kalendar' })) });
    if (health.data?.length) groups.push({ label: '🏥 Zdraví', items: health.data.map(h => ({ icon: '🏥', title: h.title, sub: h.next_date ? formatDate(h.next_date) : '', page: 'zdravi' })) });
    if (cars.data?.length) groups.push({ label: '🚗 Auta', items: cars.data.map(c => ({ icon: '🚗', title: c.name, sub: c.plate ?? '', page: 'auto' })) });
    if (services.data?.length) groups.push({ label: '🔧 Servisy', items: services.data.map(s => ({ icon: '🔧', title: s.description, sub: `${s.cars?.name ?? ''} · ${s.date ? formatDate(s.date) : ''}`, page: 'auto' })) });
    if (contr.data?.length) groups.push({ label: '📋 Smlouvy', items: contr.data.map(c => ({ icon: '📋', title: c.name, sub: c.provider ?? '', page: 'smlouvy' })) });
    if (warranties.data?.length) groups.push({ label: '📦 Záruky', items: warranties.data.map(w => ({ icon: '📦', title: w.name, sub: w.store ?? (w.warranty_end ? `do ${formatDate(w.warranty_end)}` : ''), page: 'smlouvy' })) });
    if (txs.data?.length) groups.push({ label: '💰 Transakce', items: txs.data.map(t => ({ icon: t.type === 'příjem' ? '💰' : '💸', title: t.description ?? '(bez popisu)', sub: `${formatMoney(t.amount)} · ${formatDate(t.date)}`, page: 'finance' })) });
    if (recurring.data?.length) groups.push({ label: '🔁 Opakující se', items: recurring.data.map(r => ({ icon: r.type === 'příjem' ? '💰' : '💸', title: r.name, sub: formatMoney(r.amount), page: 'finance' })) });
    if (shop.data?.length) groups.push({ label: '🛒 Nákupní seznam', items: shop.data.map(s => ({ icon: '🛒', title: s.item, sub: '', page: 'domacnost' })) });

    if (!groups.length) { res.innerHTML = '<div class="search-empty">Nic nenalezeno.</div>'; return; }

    res.innerHTML = groups.map(g => `
      <div class="search-group-label">${g.label}</div>
      ${g.items.map(item => `
        <div class="search-result-item" onclick="App.navigateTo('${item.page}');App.closeSearch()">
          <span class="search-result-icon">${item.icon}</span>
          <div>
            <div class="search-result-title">${esc(item.title)}</div>
            ${item.sub ? `<div class="search-result-sub">${esc(item.sub)}</div>` : ''}
          </div>
        </div>`).join('')}
    `).join('');
  }

  // ── Widget customization ──────────────────────
  const _WIDGET_LABELS = {
    upcoming:  '📅 Co nás čeká',
    contracts: '📋 Nejbližší smlouvy k výpovědi',
    checkin:   '☀️ Denní Check-in',
  };

  function _initWidgetDragDrop() {
    const container = document.getElementById('dash-widgets');
    if (!container) return;
    let _drag = null;

    container.addEventListener('dragstart', e => {
      _drag = e.target.closest('.dash-widget');
      if (_drag) setTimeout(() => { if (_drag) _drag.style.opacity = '.4'; }, 0);
    });
    container.addEventListener('dragend', () => {
      if (_drag) { _drag.style.opacity = ''; _drag = null; }
      _saveWidgetOrder();
    });
    container.addEventListener('dragover', e => {
      e.preventDefault();
      const over = e.target.closest('.dash-widget');
      if (!over || over === _drag) return;
      const mid = over.getBoundingClientRect().top + over.getBoundingClientRect().height / 2;
      container.insertBefore(_drag, e.clientY < mid ? over : over.nextSibling);
    });
  }

  function _saveWidgetOrder() {
    const order = [...document.querySelectorAll('.dash-widget')].map(w => w.dataset.widget);
    localStorage.setItem('hpos_widget_order', JSON.stringify(order));
  }

  function _applyWidgetOrder() {
    const container = document.getElementById('dash-widgets');
    if (!container) return;
    try {
      const order = JSON.parse(localStorage.getItem('hpos_widget_order') ?? '[]');
      order.forEach(id => {
        const el = container.querySelector(`[data-widget="${id}"]`);
        if (el) container.appendChild(el);
      });
    } catch {}
  }

  function _applyWidgetVisibility() {
    try {
      const hidden = JSON.parse(localStorage.getItem('hpos_widgets_hidden') ?? '[]');
      document.querySelectorAll('.dash-widget').forEach(w => {
        w.style.display = hidden.includes(w.dataset.widget) ? 'none' : '';
      });
    } catch {}
  }

  function openWidgetCustomizer() {
    const widgets = [...document.querySelectorAll('.dash-widget')];
    const hidden  = JSON.parse(localStorage.getItem('hpos_widgets_hidden') ?? '[]');
    App.openModal('⚙️ Přizpůsobit widgety', `
      <p style="font-size:.875rem;color:var(--text-muted);margin-bottom:1rem">Přetažením na dashboardu změníte pořadí. Zde skryjete/zobrazíte widgety.</p>
      ${widgets.map(w => `
        <label style="display:flex;align-items:center;gap:.75rem;padding:.625rem 0;border-bottom:1px solid var(--border);cursor:pointer">
          <input type="checkbox" id="wvis-${w.dataset.widget}" ${!hidden.includes(w.dataset.widget) ? 'checked' : ''}>
          <span style="font-size:.9375rem">${_WIDGET_LABELS[w.dataset.widget] ?? w.dataset.widget}</span>
        </label>`).join('')}
      <div style="margin-top:1rem;padding-top:.75rem;border-top:1px solid var(--border)">
        ${typeof PinLock !== 'undefined'
          ? `<button class="btn btn-sm btn-outline" onclick="App.closeModal();PinLock.openSetup()" style="width:100%">🔑 ${PinLock.hasPIN() ? 'Změnit PIN zámek' : 'Nastavit PIN zámek'}</button>`
          : ''}
      </div>
    `, {
      saveLabel: 'Uložit',
      onSave: () => {
        const newHidden = widgets.filter(w => !document.getElementById(`wvis-${w.dataset.widget}`)?.checked).map(w => w.dataset.widget);
        localStorage.setItem('hpos_widgets_hidden', JSON.stringify(newHidden));
        _applyWidgetVisibility();
        App.closeModal();
      }
    });
  }

  document.getElementById('modal')?.addEventListener('click', (e) => {
    if (e.target.id === 'modal') closeModal();
  });
  document.getElementById('modalClose')?.addEventListener('click', closeModal);
  document.getElementById('modalCancel')?.addEventListener('click', closeModal);

  return {
    init, navigateTo, toast, openModal, closeModal, openSearch, closeSearch,
    formatMoney, formatDate, daysUntil, countdownBadge, typeColor, typeLabel, esc,
    openWidgetCustomizer
  };
})();

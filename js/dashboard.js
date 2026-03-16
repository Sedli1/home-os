/* ════════════════════════════════════════════════
   dashboard.js — Dashboard page module
   ════════════════════════════════════════════════ */

window.DashboardModule = (() => {
  'use strict';

  let initialized = false;

  const DAYS_CS = ['neděle','pondělí','úterý','středa','čtvrtek','pátek','sobota'];
  const MONTHS_CS = ['ledna','února','března','dubna','května','června','července','srpna','září','října','listopadu','prosince'];

  const TIPS = [
    { icon: '🎯', text: 'Začněte schůzku otevřenou otázkou: „Co je pro vás letos největší prioritou v oblasti komunikace?"' },
    { icon: '📊', text: 'Před každou schůzkou zkontrolujte LinkedIn profil kontaktu — poslední aktivita napoví, co ho zajímá.' },
    { icon: '💡', text: 'Pravidlo 70/30: klient by měl mluvit 70 % času. Klaďte otázky, aktivně naslouchejte.' },
    { icon: '🤝', text: 'Lístek na event je skvělý způsob, jak udržet vztah bez obchodního tlaku. Nabídněte ho jako první.' },
    { icon: '⏰', text: 'Ideální doba pro cold call: úterý–čtvrtek, 10–11 hod nebo 14–16 hod. Vyhněte se pondělnímu ránu.' },
    { icon: '📋', text: 'Po každé schůzce pošlete zápis do 24 hodin — budujete tím profesionalitu a závaznost.' },
    { icon: '🔄', text: 'Reaktivace: kontaktujte klienty, kteří nekoupili před 6–12 měsíci. Situace se mohla změnit.' },
    { icon: '💰', text: 'Nikdy neustupujte z ceny bez protihodnoty. „Nabídnu slevu, ale zkraťme závazek na 3 roky."' },
    { icon: '📱', text: 'O2 5G pokrývá 98 % populace ČR — silný argument pro firmy s mobilní pracovní silou.' },
    { icon: '🏆', text: 'Reference prodávají. Připravte si 2–3 konkrétní příběhy zákazníků z podobného segmentu.' },
    { icon: '🎪', text: 'O2 Arena: zeptejte se klienta, jaký sport nebo umění ho zajímá — lépe zacílíte pozvánku.' },
    { icon: '📈', text: 'Upsell je snazší než nová akvizice. Projděte si portfolio klientů a hledejte bílá místa.' },
  ];

  const FOCUS_KEY = 'o2_focus_v2';

  const CAT_ICONS = {
    call:      '📞',
    email:     '✉️',
    meeting:   '👥',
    offer:     '📋',
    followup:  '🔄',
    other:     '📌',
  };
  const CAT_LABELS = {
    call: 'Hovor', email: 'Email', meeting: 'Schůzka', offer: 'Nabídka', followup: 'Follow-up', other: 'Jiné',
  };

  /* ── init ── */
  function init() {
    if (initialized) { refreshDashboard(); return; }
    initialized = true;
    setDate();
    renderTips();
    renderFocusList();
    loadTicketCount();
    loadChecklistProgress();
    loadSFACount();
    setupEventListeners();
  }

  function setDate() {
    const now = new Date();
    const el = document.getElementById('dashboardDate');
    if (el) el.textContent = `${DAYS_CS[now.getDay()]}, ${now.getDate()}. ${MONTHS_CS[now.getMonth()]} ${now.getFullYear()}`;
  }

  function renderTips() {
    const el = document.getElementById('tipsList');
    if (!el) return;
    const seed = new Date().getDate();
    const items = [...TIPS].sort((a, b) => ((a.text.charCodeAt(0) * seed) % 17) - ((b.text.charCodeAt(0) * seed) % 17)).slice(0, 3);
    el.innerHTML = items.map(t => `
      <div class="tip-item">
        <span class="tip-icon">${t.icon}</span>
        <span class="tip-text">${t.text}</span>
      </div>`).join('');
  }

  async function loadTicketCount() {
    try {
      const tickets = await App.db.getTicketHistory();
      const el = document.getElementById('kpiTickets');
      if (el) el.textContent = tickets.length || 0;
    } catch { /* silent */ }
  }

  function loadSFACount() {
    try {
      const raw = localStorage.getItem('o2_sfa_drafts');
      const el    = document.getElementById('kpiSFA');
      const elSub = document.getElementById('kpiSFASub');
      if (!raw) { if (el) el.textContent = '0'; return; }
      const data = JSON.parse(raw);
      const meetings = Array.isArray(data.meetings) ? data.meetings : [];
      const done  = meetings.filter(m => m.status === 'done').length;
      const total = meetings.length;
      if (el) el.textContent = done;
      if (elSub) elSub.textContent = total > 0 ? `z ${total} schůzek` : 'Zatím žádné';
    } catch {
      const el = document.getElementById('kpiSFA');
      if (el) el.textContent = '0';
    }
  }

  async function loadChecklistProgress() {
    try {
      const state = await App.db.getChecklistState();
      const checked = Object.values(state).filter(v => v.checked).length;
      const total = 15;
      const pct = Math.round((checked / total) * 100);
      const bar = document.getElementById('dashChecklistBar');
      const label = document.getElementById('dashChecklistPct');
      if (bar) bar.style.width = `${pct}%`;
      if (label) label.textContent = `${checked} / ${total}`;
    } catch { /* silent */ }
  }

  /* ══════════════════════════════════════════
     FOCUS LIST — enhanced
  ══════════════════════════════════════════ */
  async function getFocusItems() {
    return App.db.getFocusItems();
  }
  async function saveFocusItems(items) {
    return App.db.saveFocusItems(items);
  }

  function todayISO() {
    const d = new Date();
    return d.toISOString().slice(0, 10);
  }

  function weekISO() {
    const d = new Date();
    d.setDate(d.getDate() + 7);
    return d.toISOString().slice(0, 10);
  }

  function dueDateLabel(iso) {
    if (!iso) return null;
    const today = todayISO();
    const week  = weekISO();
    if (iso < today)  return { text: 'Po termínu', cls: 'focus-due-overdue' };
    if (iso === today) return { text: 'Dnes',       cls: 'focus-due-today' };
    if (iso <= week)  return { text: formatDate(iso), cls: 'focus-due-week' };
    return { text: formatDate(iso), cls: 'focus-due-later' };
  }

  function formatDate(iso) {
    if (!iso) return '';
    const [y, m, d] = iso.split('-');
    return `${parseInt(d)}. ${parseInt(m)}.`;
  }

  async function renderFocusList() {
    const el = document.getElementById('focusList');
    if (!el) return;
    const all = await getFocusItems();
    if (!all.length) {
      el.innerHTML = '<div class="empty-state-small">Žádné priority. Klikněte <strong>+ Přidat</strong>.</div>';
      _updateOverdueBanner(0);
      return;
    }

    const today = todayISO();
    const week  = weekISO();

    const active = all.filter(i => !i.done);
    const done   = all.filter(i => i.done);

    // Groups
    const overdue    = active.filter(i => i.dueDate && i.dueDate < today);
    const todayItems = active.filter(i => i.dueDate === today);
    const thisWeek   = active.filter(i => i.dueDate && i.dueDate > today && i.dueDate <= week);
    const later      = active.filter(i => !i.dueDate || i.dueDate > week);

    _updateOverdueBanner(overdue.length);

    let html = '';

    if (overdue.length) {
      html += `<div class="focus-group-label focus-group-overdue">🚨 Po termínu</div>`;
      html += overdue.map(item => renderFocusItem(item, all)).join('');
    }
    if (todayItems.length) {
      html += `<div class="focus-group-label focus-group-today">📅 Dnes</div>`;
      html += todayItems.map(item => renderFocusItem(item, all)).join('');
    }
    if (thisWeek.length) {
      html += `<div class="focus-group-label">📆 Tento týden</div>`;
      html += thisWeek.map(item => renderFocusItem(item, all)).join('');
    }
    if (later.length) {
      if (overdue.length + todayItems.length + thisWeek.length > 0) {
        html += `<div class="focus-group-label">📋 Ostatní</div>`;
      }
      html += later.map(item => renderFocusItem(item, all)).join('');
    }
    if (done.length) {
      html += `<div class="focus-group-label focus-group-done">✅ Splněno (${done.length})</div>`;
      html += done.slice(0, 5).map(item => renderFocusItem(item, all)).join('');
    }

    el.innerHTML = html;

    // Wire checkboxes
    el.querySelectorAll('.focus-check').forEach(cb => {
      cb.addEventListener('change', async () => {
        const items = await getFocusItems();
        const idx = items.findIndex(i => String(i.id) === cb.dataset.id);
        if (idx >= 0) {
          items[idx].done = cb.checked;
          items[idx].doneAt = cb.checked ? Date.now() : null;
          await saveFocusItems(items);
          renderFocusList();
        }
      });
    });

    // Wire delete buttons
    el.querySelectorAll('.focus-delete-btn').forEach(btn => {
      btn.addEventListener('click', async () => {
        const items = (await getFocusItems()).filter(i => String(i.id) !== btn.dataset.id);
        await saveFocusItems(items);
        renderFocusList();
      });
    });

    // Wire edit buttons
    el.querySelectorAll('.focus-edit-btn').forEach(btn => {
      btn.addEventListener('click', async () => {
        const items = await getFocusItems();
        const item = items.find(i => String(i.id) === btn.dataset.id);
        if (item) openEditFocusModal(item);
      });
    });
  }

  function renderFocusItem(item, _all) {
    const due = dueDateLabel(item.dueDate);
    const catIcon = CAT_ICONS[item.category] || '📌';
    const priClass = `focus-pri-${item.priority || 'medium'}`;
    return `<div class="focus-item${item.done ? ' focus-item-done' : ''}">
      <input type="checkbox" class="focus-check" data-id="${item.id}" ${item.done ? 'checked' : ''}>
      <span class="focus-cat" title="${CAT_LABELS[item.category] || ''}">${catIcon}</span>
      <span class="focus-text">${App.escHtml(item.text)}</span>
      <div class="focus-meta">
        ${due ? `<span class="focus-due ${due.cls}">${due.text}</span>` : ''}
        <span class="focus-pri-dot ${priClass}"></span>
      </div>
      <button class="focus-edit-btn" data-id="${item.id}" title="Upravit">✏️</button>
      <button class="focus-delete-btn" data-id="${item.id}" title="Smazat">×</button>
    </div>`;
  }

  function _updateOverdueBanner(count) {
    const banner = document.getElementById('dashOverdueBanner');
    if (!banner) return;
    if (count === 0) {
      banner.classList.add('hidden');
      banner.innerHTML = '';
    } else {
      banner.classList.remove('hidden');
      banner.innerHTML = `<div class="overdue-banner">
        🚨 <strong>${count} ${count === 1 ? 'úkol po termínu' : count < 5 ? 'úkoly po termínu' : 'úkolů po termínu'}</strong> ve Focus listu — zkontrolujte priority níže.
      </div>`;
    }
  }

  function openEditFocusModal(item) {
    App.showModal({
      title: '✏️ Upravit prioritu',
      body: `
        <div class="form-group">
          <label class="form-label">Popis úkolu / priority</label>
          <input id="focusEditText" type="text" class="form-control" value="${App.escHtml(item.text)}">
        </div>
        <div class="form-row">
          <div class="form-group">
            <label class="form-label">Kategorie</label>
            <select id="focusEditCategory" class="form-control">
              <option value="call" ${item.category==='call'?'selected':''}>📞 Hovor</option>
              <option value="email" ${item.category==='email'?'selected':''}>✉️ Email</option>
              <option value="meeting" ${item.category==='meeting'?'selected':''}>👥 Schůzka</option>
              <option value="offer" ${item.category==='offer'?'selected':''}>📋 Nabídka</option>
              <option value="followup" ${item.category==='followup'?'selected':''}>🔄 Follow-up</option>
              <option value="other" ${item.category==='other'?'selected':''}>📌 Jiné</option>
            </select>
          </div>
          <div class="form-group">
            <label class="form-label">Priorita</label>
            <select id="focusEditPriority" class="form-control">
              <option value="high" ${item.priority==='high'?'selected':''}>🔴 Vysoká</option>
              <option value="medium" ${item.priority==='medium'?'selected':''}>🟡 Střední</option>
              <option value="low" ${item.priority==='low'?'selected':''}>🟢 Nízká</option>
            </select>
          </div>
        </div>
        <div class="form-group">
          <label class="form-label">Termín <span class="form-hint">(volitelný)</span></label>
          <input id="focusEditDueDate" type="date" class="form-control" value="${item.dueDate || ''}">
        </div>`,
      footer: `
        <button class="btn btn-secondary" onclick="App.closeModal()">Zrušit</button>
        <button class="btn btn-primary" onclick="DashboardModule._saveEditFocus('${item.id}')">Uložit</button>`,
    });
    setTimeout(() => document.getElementById('focusEditText')?.focus(), 100);
  }

  async function _saveEditFocus(id) {
    const text     = document.getElementById('focusEditText')?.value.trim();
    const priority = document.getElementById('focusEditPriority')?.value || 'medium';
    const category = document.getElementById('focusEditCategory')?.value || 'other';
    const dueDate  = document.getElementById('focusEditDueDate')?.value || '';
    if (!text) { App.showToast('Zadejte text priority', 'warning'); return; }
    const items = await getFocusItems();
    const idx = items.findIndex(i => String(i.id) === String(id));
    if (idx >= 0) {
      items[idx] = { ...items[idx], text, priority, category, dueDate };
      await saveFocusItems(items);
      App.closeModal();
      renderFocusList();
      App.showToast('Priorita upravena', 'success');
    }
  }

  function openAddFocusModal() {
    App.showModal({
      title: '+ Přidat prioritu',
      body: `
        <div class="form-group">
          <label class="form-label">Popis úkolu / priority</label>
          <input id="focusText" type="text" class="form-control" placeholder="Např: Připravit nabídku pro ABC s.r.o.">
        </div>
        <div class="form-row">
          <div class="form-group">
            <label class="form-label">Kategorie</label>
            <select id="focusCategory" class="form-control">
              <option value="call">📞 Hovor</option>
              <option value="email">✉️ Email</option>
              <option value="meeting">👥 Schůzka</option>
              <option value="offer">📋 Nabídka</option>
              <option value="followup">🔄 Follow-up</option>
              <option value="other">📌 Jiné</option>
            </select>
          </div>
          <div class="form-group">
            <label class="form-label">Priorita</label>
            <select id="focusPriority" class="form-control">
              <option value="high">🔴 Vysoká</option>
              <option value="medium" selected>🟡 Střední</option>
              <option value="low">🟢 Nízká</option>
            </select>
          </div>
        </div>
        <div class="form-group">
          <label class="form-label">Termín <span class="form-hint">(volitelný)</span></label>
          <input id="focusDueDate" type="date" class="form-control" value="${todayISO()}">
        </div>`,
      footer: `
        <button class="btn btn-secondary" onclick="App.closeModal()">Zrušit</button>
        <button class="btn btn-primary" onclick="DashboardModule._saveFocus()">Přidat</button>`,
    });
    setTimeout(() => document.getElementById('focusText')?.focus(), 100);
  }

  async function _saveFocus() {
    const text     = document.getElementById('focusText')?.value.trim();
    const priority = document.getElementById('focusPriority')?.value || 'medium';
    const category = document.getElementById('focusCategory')?.value || 'other';
    const dueDate  = document.getElementById('focusDueDate')?.value || '';
    if (!text) { App.showToast('Zadejte text priority', 'warning'); return; }
    const items = await getFocusItems();
    items.unshift({ id: String(Date.now() + Math.random()), text, priority, category, dueDate, done: false, doneAt: null, createdAt: Date.now() });
    await saveFocusItems(items);
    App.closeModal();
    renderFocusList();
    App.showToast('Priorita přidána', 'success');
  }

  function refreshDashboard() {
    setDate();
    loadTicketCount();
    loadChecklistProgress();
    loadSFACount();
  }

  function setupEventListeners() {
    document.getElementById('addFocusBtn')?.addEventListener('click', openAddFocusModal);
    document.getElementById('refreshDashboard')?.addEventListener('click', refreshDashboard);
    setupQuickActions();
  }

  function setupQuickActions() {
    document.querySelectorAll('.quick-action-btn[data-page]').forEach(btn => {
      btn.addEventListener('click', () => {
        const page = btn.dataset.page;
        const tab  = btn.dataset.actionTab;
        const invite = btn.dataset.actionInvite;

        // Navigate to target page
        const navLink = document.querySelector(`.nav-link[data-page="${page}"]`);
        navLink?.click();

        setTimeout(() => {
          if (tab) {
            // Switch to specific tab
            const tabBtn = document.querySelector(`[data-tab-group="${page}"][data-target="${tab}"]`);
            tabBtn?.click();
          }
          if (invite) {
            document.getElementById('openInviteGenBtn')?.click();
          }
        }, 120);
      });
    });

    // SFA KPI card click → navigate to SFA
    document.getElementById('kpiSFACard')?.addEventListener('click', () => {
      document.querySelector('.nav-link[data-page="sfa"]')?.click();
    });

    // Quick action: SFA
    document.getElementById('quickSFABtn')?.addEventListener('click', () => {
      document.querySelector('.nav-link[data-page="sfa"]')?.click();
    });

    // Quick upload: trigger the tickets upload input
    document.getElementById('quickUploadBtn')?.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();
      // Navigate to tickets first
      const navLink = document.querySelector('.nav-link[data-page="tickets"]');
      navLink?.click();
      setTimeout(() => {
        document.getElementById('ticketsUpload')?.click();
      }, 150);
    });
  }

  return { init, _saveFocus, _saveEditFocus };
})();

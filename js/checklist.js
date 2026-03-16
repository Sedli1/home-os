/* ════════════════════════════════════════════════
   checklist.js — Pre-sales meeting checklist
   ════════════════════════════════════════════════ */

window.ChecklistModule = (() => {
  'use strict';

  let initialized = false;
  let state = {}; // { [key]: { checked, notes } }

  const ITEMS = [
    { key: 'research_web',      label: 'Research klienta — web firmy',              category: 'Research',    hint: 'Prostudujte aktuální stránky, produkty, novinky.' },
    { key: 'linkedin',          label: 'LinkedIn profil kontaktu',                   category: 'Research',    hint: 'Zkontrolujte pozici, historii, zájmy, mutual connections.' },
    { key: 'ares',              label: 'ARES — základní info o firmě',               category: 'Research',    hint: 'IČO, obrat, počet zaměstnanců, sídlo.' },
    { key: 'obchodni_rejstrik', label: 'Obchodní rejstřík — struktura společnosti',  category: 'Research',    hint: 'Jednatelé, dceřiné společnosti, změny.' },
    { key: 'aktualni_smlouva',  label: 'Aktuální smlouva s O2 (pokud existuje)',     category: 'O2 Data',     hint: 'Délka, produkty, ARPU, datum ukončení.' },
    { key: 'kompetice',         label: 'Analýza konkurence v dané firmě',            category: 'Trh',         hint: 'Kdo je stávající dodavatel? Proč zvažují změnu?' },
    { key: 'priprava_nabidky',  label: 'Příprava nabídky / prezentace',             category: 'Příprava',    hint: 'Konkrétní produkty O2 relevantní pro tohoto klienta.' },
    { key: 'reference',         label: 'Referenční zákazníci v segmentu',            category: 'Příprava',    hint: 'Připravte 2–3 příběhy ze stejného odvětví.' },
    { key: 'produkty_o2',       label: 'Přehled O2 produktů pro potřeby klienta',   category: 'Příprava',    hint: 'Identifikujte relevantní služby: mobil, data, cloud, IoT.' },
    { key: 'otazky',            label: 'Příprava otázek na schůzku',                category: 'Příprava',    hint: 'Min. 5 otevřených otázek pro discovery fázi.' },
    { key: 'agenda',            label: 'Agenda schůzky',                             category: 'Schůzka',     hint: 'Sdílejte agendu klientovi předem — budujete profesionalitu.' },
    { key: 'potential',         label: 'Odhad potenciálu (revenue)',                 category: 'Obchod',      hint: 'Odhadněte počet uživatelů, linek, datové potřeby.' },
    { key: 'rozhodovatele',     label: 'Identifikace rozhodovatelů',                 category: 'Obchod',      hint: 'Kdo je ekonomický buyer? Kdo je user buyer? Kdo blokuje?' },
    { key: 'business_case',     label: 'Business case pro klienta',                  category: 'Obchod',      hint: 'Proč O2? Jaký je ROI pro klienta v konkrétních číslech?' },
    { key: 'logistika',         label: 'Logistika — čas, místo, technika',          category: 'Schůzka',     hint: 'Confirmed? Prezentační technika? Vizitky? Parkování?' },
  ];

  /* ─── Init ─── */
  async function init() {
    if (initialized) return;
    initialized = true;

    state = await App.db.getChecklistState();
    renderItems();
    updateProgress();
    setupControls();
  }

  /* ─── Render ─── */
  function renderItems() {
    const container = document.getElementById('checklistItems');
    if (!container) return;

    container.innerHTML = ITEMS.map(item => {
      const s = state[item.key] || { checked: false, notes: '' };
      return `
        <div class="checklist-item ${s.checked ? 'completed' : ''}" id="ci-${item.key}">
          <div class="checklist-item-header">
            <div class="checklist-checkbox" data-key="${item.key}"></div>
            <div class="checklist-item-text">${App.escHtml(item.label)}</div>
            <span class="checklist-item-category">${item.category}</span>
            <button class="checklist-expand-btn" data-key="${item.key}" title="Poznámka">▾</button>
          </div>
          <div class="checklist-item-notes">
            <div style="font-size:12px;color:var(--text-secondary);margin-bottom:.35rem">${item.hint}</div>
            <textarea class="checklist-notes-input" data-key="${item.key}" rows="2"
              placeholder="Poznámka...">${App.escHtml(s.notes)}</textarea>
          </div>
        </div>`;
    }).join('');

    // Checkbox click
    container.querySelectorAll('.checklist-checkbox').forEach(cb => {
      cb.addEventListener('click', () => toggleItem(cb.dataset.key));
    });

    // Header row click for toggle check
    container.querySelectorAll('.checklist-item-header').forEach(header => {
      header.addEventListener('click', (e) => {
        if (e.target.classList.contains('checklist-expand-btn') ||
            e.target.classList.contains('checklist-checkbox')) return;
        const key = header.querySelector('.checklist-checkbox')?.dataset.key;
        if (key) toggleItem(key);
      });
    });

    // Expand toggle
    container.querySelectorAll('.checklist-expand-btn').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const item = document.getElementById(`ci-${btn.dataset.key}`);
        item?.classList.toggle('expanded');
      });
    });

    // Notes autosave
    container.querySelectorAll('.checklist-notes-input').forEach(ta => {
      ta.addEventListener('input', debounce(() => saveNotes(ta.dataset.key, ta.value), 800));
      ta.addEventListener('click', (e) => e.stopPropagation());
    });
  }

  async function toggleItem(key) {
    const s = state[key] || { checked: false, notes: '' };
    s.checked = !s.checked;
    state[key] = s;

    const el = document.getElementById(`ci-${key}`);
    if (el) el.classList.toggle('completed', s.checked);

    updateProgress();

    try {
      await App.db.saveChecklistItem(key, s.checked, s.notes);
    } catch { /* silent */ }
  }

  async function saveNotes(key, notes) {
    const s = state[key] || { checked: false, notes: '' };
    s.notes = notes;
    state[key] = s;
    try {
      await App.db.saveChecklistItem(key, s.checked, notes);
    } catch { /* silent */ }
  }

  /* ─── Progress ─── */
  function updateProgress() {
    const checked = Object.values(state).filter(s => s.checked).length;
    const total = ITEMS.length;
    const pct = Math.round((checked / total) * 100);

    const bar = document.getElementById('checklistBar');
    const label = document.getElementById('checklistProgLabel');
    const pctEl = document.getElementById('checklistProgPct');

    if (bar) bar.style.width = `${pct}%`;
    if (label) label.textContent = `Připravenost: ${checked} / ${total}`;
    if (pctEl) pctEl.textContent = `${pct}%`;

    // Update dashboard widget
    const dashBar = document.getElementById('dashChecklistBar');
    const dashPct = document.getElementById('dashChecklistPct');
    if (dashBar) dashBar.style.width = `${pct}%`;
    if (dashPct) dashPct.textContent = `${checked} / ${total}`;
  }

  /* ─── Controls ─── */
  function setupControls() {
    document.getElementById('resetChecklistBtn')?.addEventListener('click', async () => {
      if (!confirm('Opravdu resetovat celý checklist? Vymažou se i poznámky.')) return;
      state = {};
      await App.db.clearChecklist();
      renderItems();
      updateProgress();
      App.showToast('Checklist resetován', 'info');
    });

    document.getElementById('exportChecklistBtn')?.addEventListener('click', exportChecklist);
  }

  function exportChecklist() {
    const clientName = document.getElementById('checklistClientName')?.value.trim() || 'Schůzka';
    const dateStr = new Date().toLocaleDateString('cs-CZ');
    const lines = [`PŘEDPRODEJNÍ CHECKLIST — ${clientName}`, `Datum: ${dateStr}`, ''];

    let currentCat = '';
    ITEMS.forEach(item => {
      if (item.category !== currentCat) {
        currentCat = item.category;
        lines.push(`\n── ${currentCat} ──`);
      }
      const s = state[item.key] || { checked: false, notes: '' };
      lines.push(`${s.checked ? '✅' : '⬜'} ${item.label}`);
      if (s.notes) lines.push(`   📝 ${s.notes}`);
    });

    const checked = Object.values(state).filter(s => s.checked).length;
    lines.push(`\n── VÝSLEDEK ──`);
    lines.push(`Splněno: ${checked} / ${ITEMS.length} (${Math.round((checked / ITEMS.length) * 100)}%)`);

    const blob = new Blob([lines.join('\n')], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `checklist-${clientName.replace(/\s+/g, '-')}-${dateStr.replace(/\./g, '-')}.txt`;
    a.click();
    URL.revokeObjectURL(url);
    App.showToast('Checklist exportován', 'success');
  }

  function debounce(fn, ms) {
    let t;
    return (...args) => { clearTimeout(t); t = setTimeout(() => fn(...args), ms); };
  }

  return { init };
})();

/* ════════════════════════════════════════════════
   sfa.js — SFA Meeting Generator
   Generátor zápisů ze schůzek + Claude Cowork prompt
   ════════════════════════════════════════════════ */

window.SFAModule = (() => {
  'use strict';

  let initialized = false;
  let meetings    = [];   // array of meeting objects
  let nextId      = 1;
  let sfaMode     = 'close'; // 'close' | 'new'

  const DRAFT_KEY   = 'o2_sfa_drafts';
  const HISTORY_KEY = 'o2_sfa_history';   // { [lcName]: { company, ico, address, contacts[] } }

  /* ══════════════════════════════════════════
     COMPANY / CONTACT HISTORY
  ══════════════════════════════════════════ */
  function getHistory() {
    try { return JSON.parse(localStorage.getItem(HISTORY_KEY) || '{}'); }
    catch { return {}; }
  }

  function saveToHistory(m) {
    if (!m.company) return;
    const h   = getHistory();
    const key = m.company.trim().toLowerCase();
    if (!h[key]) {
      h[key] = { company: m.company.trim(), ico: '', address: '', contacts: [] };
    }
    if (m.ico)     h[key].ico     = m.ico;
    if (m.address) h[key].address = m.address;
    if (m.contact && !h[key].contacts.includes(m.contact.trim())) {
      h[key].contacts.unshift(m.contact.trim());
      if (h[key].contacts.length > 5) h[key].contacts.pop();
    }
    try { localStorage.setItem(HISTORY_KEY, JSON.stringify(h)); } catch { /* quota */ }
  }

  function getCompanyOptions() {
    return Object.values(getHistory()).map(e => e.company).filter(Boolean).sort();
  }

  function getContactOptions(company) {
    if (!company) return [];
    const h = getHistory();
    return h[company.trim().toLowerCase()]?.contacts || [];
  }

  function getCompanyData(company) {
    if (!company) return null;
    return getHistory()[company.trim().toLowerCase()] || null;
  }

  function _deleteCompanyFromHistory(company) {
    if (!company) return;
    const h = getHistory();
    delete h[company.trim().toLowerCase()];
    try { localStorage.setItem(HISTORY_KEY, JSON.stringify(h)); } catch {}
  }

  function _deleteContactFromHistory(company, contact) {
    if (!company || !contact) return;
    const h = getHistory();
    const key = company.trim().toLowerCase();
    if (h[key]) {
      h[key].contacts = (h[key].contacts || []).filter(c => c !== contact);
      try { localStorage.setItem(HISTORY_KEY, JSON.stringify(h)); } catch {}
    }
  }

  /* ══════════════════════════════════════════
     UTILITIES
  ══════════════════════════════════════════ */
  function esc(s) { return App.escHtml ? App.escHtml(s) : String(s ?? '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;'); }

  /* ── Datetime helpers ── */
  // Convert "YYYY-MM-DDTHH:MM" → "10.3.2026 10:00" for display/storage
  function dtLocalToDisplay(v) {
    if (!v) return '';
    const m = v.match(/^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})/);
    if (!m) return v;
    return `${parseInt(m[3])}.${parseInt(m[2])}.${m[1]} ${m[4]}:${m[5]}`;
  }
  // Convert "10.3.2026 10:00" or "10.3.2026, 10:00" → "YYYY-MM-DDTHH:MM" for input value
  function dtDisplayToLocal(v) {
    if (!v) return '';
    if (/^\d{4}-\d{2}-\d{2}T/.test(v)) return v.slice(0, 16); // already ISO
    const m = v.match(/(\d{1,2})[.\-\/](\d{1,2})[.\-\/](\d{4})[,\s]+(\d{2}):(\d{2})/);
    if (!m) return '';
    return `${m[3]}-${m[2].padStart(2,'0')}-${m[1].padStart(2,'0')}T${m[4]}:${m[5]}`;
  }

  function newMeeting() {
    return {
      id:          nextId++,
      ico:         '',
      company:     '',
      address:     '',
      contact:     '',
      datetime:    '',
      meetingType: 'personal',  // 'personal' | 'online'
      discussed:   '',
      nextSteps:   '',
      deadlines:   '',
      aiEmail:     '',
      subject:     '',
      status:      'draft',    // 'draft' | 'generating' | 'done'
      collapsed:   false,
    };
  }

  /* ══════════════════════════════════════════
     INIT
  ══════════════════════════════════════════ */
  function init() {
    if (initialized) { renderMeetings(); return; }
    initialized = true;

    loadDrafts();

    if (!meetings.length) {
      meetings.push(newMeeting());
    }

    renderMeetings();
    bindStaticButtons();
  }

  function bindStaticButtons() {
    document.getElementById('sfaAddMeetingBtn')?.addEventListener('click', addMeeting);
    document.getElementById('sfaGenerateAllBtn')?.addEventListener('click', generateAll);
    document.getElementById('sfaAssembleBtn')?.addEventListener('click', renderSFAPrompt);
    document.getElementById('sfaCopyPromptBtn')?.addEventListener('click', copyPrompt);
    document.getElementById('sfaResetBtn')?.addEventListener('click', resetMeetings);
    document.getElementById('sfaExportAllBtn')?.addEventListener('click', _downloadAllICS);
  }

  function resetMeetings() {
    if (!confirm('Smazat všechny záznamy a začít novou sadu schůzek?')) return;
    meetings = [newMeeting()];
    nextId   = 2;
    try { localStorage.removeItem(DRAFT_KEY); } catch {}
    document.getElementById('sfaOutputSection')?.classList.add('hidden');
    renderMeetings();
    App.showToast('🗑️ Nová sada zápisů připravena', 'success');
  }

  /* ══════════════════════════════════════════
     MEETING MANAGEMENT
  ══════════════════════════════════════════ */
  function addMeeting() {
    // Flush current forms first
    meetings.forEach(m => { if (!m.collapsed) flushForm(m.id); });
    const m = newMeeting();
    meetings.push(m);
    renderMeetings();
    // Scroll to new card
    setTimeout(() => {
      document.getElementById(`sfa-card-${m.id}`)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }, 60);
  }

  function removeMeeting(id) {
    if (meetings.length === 1) {
      // Reset to fresh empty meeting instead of blocking deletion
      meetings = [newMeeting()];
      nextId = meetings[0].id + 1;
      try { localStorage.removeItem(DRAFT_KEY); } catch {}
      document.getElementById('sfaOutputSection')?.classList.add('hidden');
      renderMeetings();
      App.showToast('🗑️ Schůzka smazána — nový záznam připraven', 'info');
      return;
    }
    meetings = meetings.filter(m => m.id !== id);
    renderMeetings();
    saveDrafts();
  }

  function toggleCollapse(id) {
    const m = meetings.find(m => m.id === id);
    if (!m) return;
    if (!m.collapsed) flushForm(id); // save before collapsing
    m.collapsed = !m.collapsed;
    renderMeetings();
  }

  /* ── Read form fields into meeting object ── */
  function flushForm(id) {
    const m = meetings.find(m => m.id === id);
    if (!m) return;
    m.ico       = document.getElementById(`sfa-ico-${id}`)?.value.trim()       || m.ico;
    m.company   = document.getElementById(`sfa-company-${id}`)?.value.trim()   || m.company;
    m.address   = document.getElementById(`sfa-address-${id}`)?.value.trim()   || m.address;
    m.contact   = document.getElementById(`sfa-contact-${id}`)?.value.trim()   || m.contact;
    const dtRaw = document.getElementById(`sfa-datetime-${id}`)?.value.trim()  || '';
    if (dtRaw) m.datetime = dtLocalToDisplay(dtRaw);
    if (sfaMode === 'new') {
      m.subject   = document.getElementById(`sfa-subject-${id}`)?.value.trim() || m.subject;
    } else {
      m.discussed = document.getElementById(`sfa-discussed-${id}`)?.value.trim() || m.discussed;
      m.nextSteps = document.getElementById(`sfa-nextsteps-${id}`)?.value.trim() || m.nextSteps;
      m.deadlines = document.getElementById(`sfa-deadlines-${id}`)?.value.trim() || m.deadlines;
    }
    // Read meeting type from toggle
    const onlineBtn = document.querySelector(`#sfa-card-${id} .sfa-type-btn[data-type="online"]`);
    if (onlineBtn) m.meetingType = onlineBtn.classList.contains('active') ? 'online' : 'personal';
    saveDrafts();
  }

  /* ══════════════════════════════════════════
     RENDER
  ══════════════════════════════════════════ */
  function renderMeetings() {
    const list = document.getElementById('sfaMeetingsList');
    if (!list) return;

    const modeToggle = `
<div class="sfa-mode-bar">
  <span class="sfa-mode-label">Typ záznamu:</span>
  <div class="sfa-mode-toggle">
    <button type="button" class="sfa-mode-btn${sfaMode === 'close' ? ' active' : ''}" onclick="SFAModule._setMode('close')">✅ Uzavřít schůzku</button>
    <button type="button" class="sfa-mode-btn${sfaMode === 'new' ? ' active' : ''}" onclick="SFAModule._setMode('new')">➕ Nová schůzka</button>
  </div>
</div>`;

    list.innerHTML = modeToggle + meetings.map((m, idx) => meetingCardHtml(m, idx + 1)).join('');

    // Bind per-card events
    meetings.forEach(m => {
      // Header toggle
      document.getElementById(`sfa-header-${m.id}`)?.addEventListener('click', (e) => {
        if (e.target.closest('.sfa-card-btn')) return; // ignore button clicks
        toggleCollapse(m.id);
      });

      // Remove button
      document.getElementById(`sfa-remove-${m.id}`)?.addEventListener('click', (e) => {
        e.stopPropagation();
        if (confirm('Odebrat tuto schůzku?')) removeMeeting(m.id);
      });

      // Generate button
      document.getElementById(`sfa-gen-${m.id}`)?.addEventListener('click', () => generateOne(m.id));

      // ARES lookup on IČ blur + Enter key
      document.getElementById(`sfa-ico-${m.id}`)?.addEventListener('blur', () => aresLookup(m.id));
      document.getElementById(`sfa-ico-${m.id}`)?.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') { e.preventDefault(); _ares(m.id); }
      });

      // Click anywhere on datetime → open native picker
      const dtEl = document.getElementById(`sfa-datetime-${m.id}`);
      dtEl?.addEventListener('click', () => dtEl.showPicker?.());

      // Meeting type toggle
      document.querySelectorAll(`#sfa-card-${m.id} .sfa-type-btn`).forEach(btn => {
        btn.addEventListener('click', (e) => {
          e.stopPropagation();
          const type = btn.dataset.type;
          const mtg = meetings.find(x => x.id === m.id);
          if (mtg) mtg.meetingType = type;
          document.querySelectorAll(`#sfa-card-${m.id} .sfa-type-btn`).forEach(b =>
            b.classList.toggle('active', b.dataset.type === type)
          );
          // Auto-fill / clear address for online/personal
          const addrEl = document.getElementById(`sfa-address-${m.id}`);
          if (type === 'online') {
            if (addrEl && !addrEl.value.trim()) {
              addrEl.value = 'Schůzka Microsoft Teams';
              if (mtg) mtg.address = 'Schůzka Microsoft Teams';
            }
          } else if (type === 'personal') {
            if (addrEl && addrEl.value === 'Schůzka Microsoft Teams') {
              addrEl.value = '';
              if (mtg) mtg.address = '';
            }
          }
          // Update the hint text without full re-render
          const hint = document.querySelector(`#sfa-card-${m.id} .sfa-type-group .form-hint`);
          if (type === 'online' && !hint) renderMeetings();
          else if (type === 'personal' && hint) renderMeetings();
          saveDrafts();
        });
      });

      // Quick Focus button
      document.getElementById(`sfa-focus-${m.id}`)?.addEventListener('click', (e) => {
        e.stopPropagation();
        _addToFocus(m.id);
      });

      // ── Company history panel ──
      const compInp  = document.getElementById(`sfa-company-${m.id}`);
      const compHist = document.getElementById(`sfa-hist-company-${m.id}`);

      function filterCompHist(val) {
        if (!compHist) return;
        const v = (val || '').toLowerCase().trim();
        let any = false;
        compHist.querySelectorAll('.sfa-hist-item').forEach(el => {
          const vis = !v || el.dataset.value.toLowerCase().includes(v);
          el.classList.toggle('sfa-hidden', !vis);
          if (vis) any = true;
        });
        compHist.classList.toggle('sfa-hist-open', any || !v);
      }

      document.getElementById(`sfa-company-expand-${m.id}`)?.addEventListener('click', (e) => {
        e.stopPropagation();
        if (compInp) { compInp.value = ''; compInp.focus(); }
        filterCompHist('');
      });
      compInp?.addEventListener('focus', () => filterCompHist(compInp.value));
      compInp?.addEventListener('input', () => filterCompHist(compInp.value));
      compInp?.addEventListener('blur',  () => setTimeout(() => compHist?.classList.remove('sfa-hist-open'), 160));
      compHist?.querySelectorAll('.sfa-hist-name').forEach(el => {
        el.addEventListener('mousedown', (e) => {
          e.preventDefault();
          if (compInp) compInp.value = el.textContent;
          compInp?.dispatchEvent(new Event('change'));
          compHist.classList.remove('sfa-hist-open');
        });
      });
      compHist?.querySelectorAll('.sfa-hist-del').forEach(btn => {
        btn.addEventListener('mousedown', (e) => {
          e.preventDefault();
          e.stopPropagation();
          _deleteCompanyFromHistory(btn.dataset.value);
          btn.closest('.sfa-hist-item')?.remove();
        });
      });

      // ── Contact history panel ──
      const contInp  = document.getElementById(`sfa-contact-${m.id}`);
      const contHist = document.getElementById(`sfa-hist-contact-${m.id}`);

      function filterContHist(val) {
        if (!contHist) return;
        const v = (val || '').toLowerCase().trim();
        let any = false;
        contHist.querySelectorAll('.sfa-hist-item').forEach(el => {
          const vis = !v || el.dataset.value.toLowerCase().includes(v);
          el.classList.toggle('sfa-hidden', !vis);
          if (vis) any = true;
        });
        contHist.classList.toggle('sfa-hist-open', any || !v);
      }

      contInp?.addEventListener('focus', () => filterContHist(contInp.value));
      contInp?.addEventListener('input', () => filterContHist(contInp.value));
      contInp?.addEventListener('blur',  () => setTimeout(() => contHist?.classList.remove('sfa-hist-open'), 160));
      contHist?.querySelectorAll('.sfa-hist-name').forEach(el => {
        el.addEventListener('mousedown', (e) => {
          e.preventDefault();
          if (contInp) contInp.value = el.textContent;
          contHist.classList.remove('sfa-hist-open');
        });
      });
      contHist?.querySelectorAll('.sfa-hist-del').forEach(btn => {
        btn.addEventListener('mousedown', (e) => {
          e.preventDefault();
          e.stopPropagation();
          const currentCompany = compInp?.value || '';
          _deleteContactFromHistory(currentCompany, btn.dataset.value);
          btn.closest('.sfa-hist-item')?.remove();
        });
      });

      // Company autocomplete: when user picks/types a company, fill IČ/address/contact from history
      document.getElementById(`sfa-company-${m.id}`)?.addEventListener('change', () => {
        const company = document.getElementById(`sfa-company-${m.id}`)?.value.trim();
        if (!company) return;

        // Update contact history panel for this company
        const contacts = getContactOptions(company);
        const contHistPanel = document.getElementById(`sfa-hist-contact-${m.id}`);
        if (contHistPanel) {
          contHistPanel.innerHTML = contacts.length
            ? contacts.map(c => `<div class="sfa-hist-item" data-value="${esc(c)}"><span class="sfa-hist-name">${esc(c)}</span><button type="button" class="sfa-hist-del" data-value="${esc(c)}" title="Smazat kontakt z historie">×</button></div>`).join('')
            : '';
          // Re-bind events for refreshed items
          contHistPanel.querySelectorAll('.sfa-hist-name').forEach(el => {
            el.addEventListener('mousedown', (e) => {
              e.preventDefault();
              const ci = document.getElementById(`sfa-contact-${m.id}`);
              if (ci) ci.value = el.textContent;
              contHistPanel.classList.remove('sfa-hist-open');
            });
          });
          contHistPanel.querySelectorAll('.sfa-hist-del').forEach(btn => {
            btn.addEventListener('mousedown', (e) => {
              e.preventDefault();
              e.stopPropagation();
              _deleteContactFromHistory(company, btn.dataset.value);
              btn.closest('.sfa-hist-item')?.remove();
            });
          });
        }

        // Autofill IČ / address / contact from history — always overwrite IČO & address
        const data = getCompanyData(company);
        if (data) {
          const icoEl     = document.getElementById(`sfa-ico-${m.id}`);
          const addrEl    = document.getElementById(`sfa-address-${m.id}`);
          const contactEl = document.getElementById(`sfa-contact-${m.id}`);
          if (icoEl  && data.ico)     icoEl.value  = data.ico;
          if (addrEl && data.address) addrEl.value = data.address;
          // Auto-fill first contact only if there's exactly one known contact
          if (contactEl && !contactEl.value && contacts.length === 1) contactEl.value = contacts[0];
        }

        // Auto-update subject in new mode — if subject is empty or still follows O2 pattern
        if (sfaMode === 'new') {
          const subjEl = document.getElementById(`sfa-subject-${m.id}`);
          if (subjEl) {
            const currentSubj = subjEl.value.trim();
            if (!currentSubj || currentSubj.startsWith('O2 Czech Republic')) {
              subjEl.value = company ? `O2 Czech Republic \u2013 ${company}` : '';
            }
          }
        }
      });

      // Auto-save on any change in this card
      const card = document.getElementById(`sfa-card-${m.id}`);
      card?.querySelectorAll('input, textarea').forEach(el => {
        el.addEventListener('input', () => saveDrafts());
      });
    });

    updateActionBar();
  }

  function meetingCardHtml(m, n) {
    const statusBadge = statusBadgeHtml(m.status);
    const companyLabel = m.company || m.contact || 'Nová schůzka';
    const dateLabel = m.datetime ? `<span class="sfa-date-chip">📅 ${esc(m.datetime)}</span>` : '';
    const chevron = m.collapsed ? '›' : '⌄';

    const bodyClass = m.collapsed ? 'sfa-card-body collapsed' : 'sfa-card-body';

    return `
<div class="sfa-meeting-card" id="sfa-card-${m.id}" data-id="${m.id}" data-status="${m.status}">
  <div class="sfa-card-header" id="sfa-header-${m.id}">
    <span class="sfa-meeting-num">Schůzka ${n}</span>
    <div class="sfa-card-title">
      <span class="sfa-company-label">${esc(companyLabel)}</span>
      ${dateLabel}
    </div>
    <div class="sfa-card-header-right">
      ${statusBadge}
      <button class="btn btn-sm btn-ghost sfa-card-btn" id="sfa-remove-${m.id}" title="Odebrat schůzku">✕</button>
      <span class="sfa-chevron">${chevron}</span>
    </div>
  </div>

  <div class="${bodyClass}">
    ${formHtml(m)}
    ${m.aiEmail ? aiPreviewHtml(m) : ''}
    <div class="sfa-card-footer">
      ${sfaMode === 'close' && m.nextSteps ? `<button class="btn btn-sm btn-ghost sfa-card-btn" id="sfa-focus-${m.id}" title="Přidat první next step do Focus listu na dashboardu">➕ Do priorit</button>` : ''}
      ${sfaMode === 'new' ? `
        <button class="btn btn-sm btn-secondary sfa-card-btn" onclick="SFAModule._downloadICS(${m.id}); event.stopPropagation()" title="Stáhnout .ics soubor — otevře schůzku v Outlooku i O365">📅 Do Outlooku</button>
        <span class="form-hint" style="align-self:center; margin-left:auto">nebo Sestavit SFA prompt ↓</span>
      ` : `<button class="btn btn-primary sfa-card-btn" id="sfa-gen-${m.id}"
        ${m.status === 'generating' ? 'disabled' : ''}>
        ${m.status === 'generating' ? '⏳ Generuji…' : m.status === 'done' ? '🔁 Přegenerovat' : '✨ Vygenerovat zápis'}
      </button>`}
    </div>
  </div>
</div>`;
  }

  function formHtml(m) {
    const companyOpts  = getCompanyOptions().map(c => `<option value="${esc(c)}">`).join('');
    const contactOpts  = getContactOptions(m.company).map(c => `<option value="${esc(c)}">`).join('');
    const isNew = sfaMode === 'new';
    return `
<datalist id="sfa-dl-company-${m.id}">${companyOpts}</datalist>
<datalist id="sfa-dl-contact-${m.id}">${contactOpts}</datalist>
<div class="sfa-form-grid">
  <div class="sfa-form-row">
    <div class="form-group sfa-ico-group">
      <label class="form-label">IČ společnosti *</label>
      <div class="sfa-ico-row">
        <input type="text" id="sfa-ico-${m.id}" class="form-control" value="${esc(m.ico)}"
          placeholder="12345678" maxlength="8" inputmode="numeric">
        <button class="btn btn-sm btn-secondary sfa-card-btn sfa-ares-btn" id="sfa-aresBtn-${m.id}"
          onclick="SFAModule._ares(${m.id}); event.stopPropagation()" title="Doplnit název firmy z ARES">🔍 Doplnit firmu</button>
      </div>
      <span class="form-hint" id="sfa-aresHint-${m.id}"></span>
      <div id="sfa-aresLinks-${m.id}" class="sfa-ares-links hidden"></div>
    </div>
    <div class="form-group">
      <label class="form-label">Název společnosti *</label>
      <div class="sfa-company-wrap">
        <input type="text" id="sfa-company-${m.id}" class="form-control" value="${esc(m.company)}"
          placeholder="ABC s.r.o." autocomplete="off">
        <button type="button" class="sfa-company-expand-btn" id="sfa-company-expand-${m.id}" title="Zobrazit všechny firmy z historie">▾</button>
        <div class="sfa-hist-panel" id="sfa-hist-company-${m.id}">
          ${getCompanyOptions().map(c => `<div class="sfa-hist-item" data-value="${esc(c)}"><span class="sfa-hist-name">${esc(c)}</span><button type="button" class="sfa-hist-del" data-value="${esc(c)}" title="Smazat z historie">×</button></div>`).join('') || '<div class="sfa-hist-empty">Žádná historie</div>'}
        </div>
      </div>
    </div>
  </div>

  <div class="form-group">
    <label class="form-label">Adresa sídla <span class="form-hint">(doplní se automaticky z ARES)</span></label>
    <input type="text" id="sfa-address-${m.id}" class="form-control" value="${esc(m.address)}"
      placeholder="Ulice 123, 140 00 Praha 4">
  </div>

  <div class="sfa-form-row">
    <div class="form-group">
      <label class="form-label">Jméno kontaktní osoby *</label>
      <div class="sfa-hist-wrap">
        <input type="text" id="sfa-contact-${m.id}" class="form-control" value="${esc(m.contact)}"
          placeholder="Ing. Jan Novák" autocomplete="off">
        <div class="sfa-hist-panel" id="sfa-hist-contact-${m.id}">
          ${getContactOptions(m.company).map(c => `<div class="sfa-hist-item" data-value="${esc(c)}"><span class="sfa-hist-name">${esc(c)}</span><button type="button" class="sfa-hist-del" data-value="${esc(c)}" title="Smazat kontakt z historie">×</button></div>`).join('')}
        </div>
      </div>
    </div>
    <div class="form-group">
      <label class="form-label">Datum a čas schůzky${isNew ? ' zahájení' : ''}</label>
      <input type="datetime-local" id="sfa-datetime-${m.id}" class="form-control"
        value="${dtDisplayToLocal(m.datetime)}">
    </div>
  </div>

  ${isNew ? `
  <div class="form-group">
    <label class="form-label">Předmět schůzky v SFA</label>
    <input type="text" id="sfa-subject-${m.id}" class="form-control" value="${esc(m.subject || (m.company ? 'O2 Czech Republic \u2013 ' + m.company : ''))}"
      placeholder="O2 Czech Republic – název firmy">
  </div>` : ''}

  <div class="form-group sfa-type-group">
    <label class="form-label">Typ schůzky</label>
    <div class="sfa-type-toggle">
      <button type="button" class="sfa-type-btn${m.meetingType !== 'online' ? ' active' : ''}" data-type="personal">🏢 Osobní</button>
      <button type="button" class="sfa-type-btn${m.meetingType === 'online' ? ' active' : ''}" data-type="online">💻 Online (Teams)</button>
    </div>
    ${m.meetingType === 'online' ? '<span class="form-hint">Adresa schůzky: <em>Schůzka Microsoft Teams</em> — prompt zaškrtne „Online schůzka" v SFA</span>' : ''}
  </div>

  ${!isNew ? `
  <div class="form-group">
    <label class="form-label">Co bylo projednáno</label>
    <textarea id="sfa-discussed-${m.id}" class="form-control" rows="3"
      placeholder="• Zákazník zvažuje rozšíření mobilního tarifu&#10;• Probrali jsme nové řešení IoT&#10;• Zájem o nabídku fixed-mobile konvergence">${esc(m.discussed)}</textarea>
  </div>

  <div class="sfa-form-row">
    <div class="form-group">
      <label class="form-label">Dohodnuté kroky / next steps</label>
      <textarea id="sfa-nextsteps-${m.id}" class="form-control" rows="3"
        placeholder="• Jakub připraví cenovou nabídku do 15.3.&#10;• Zákazník potvrdí seznam uživatelů&#10;• Naplánovat demo call">${esc(m.nextSteps)}</textarea>
    </div>
    <div class="form-group">
      <label class="form-label">Termíny a závazky</label>
      <textarea id="sfa-deadlines-${m.id}" class="form-control" rows="3"
        placeholder="• Nabídka: do 15.3.2026&#10;• Podpis smlouvy: do konce Q1&#10;• Go-live: 1.4.2026">${esc(m.deadlines)}</textarea>
    </div>
  </div>` : ''}
</div>`;
  }

  function buildMailto(m) {
    const subj = encodeURIComponent(m.subject || `O2 Czech Republic – Zápis ze schůzky, ${m.company}`);
    // Strip signature — Outlook adds it automatically from account settings
    const bodyWithoutSig = (m.aiEmail || '')
      .replace(/\nS pozdravem[\s\S]*$/, '')
      .trim();
    const body = encodeURIComponent(bodyWithoutSig.slice(0, 1800));
    return `mailto:?subject=${subj}&body=${body}`;
  }

  function aiPreviewHtml(m) {
    return `
<div class="sfa-ai-preview">
  ${m.subject ? `<div class="sfa-email-subject">📌 Předmět: <strong>${esc(m.subject)}</strong></div>` : ''}
  <div class="sfa-ai-preview-header">
    <span>✉️ Vygenerovaný zápis</span>
    <div class="sfa-ai-btns">
      ${m.subject ? `<button class="btn btn-sm btn-ghost sfa-card-btn" onclick="SFAModule._copySubject(${m.id}); event.stopPropagation()" title="Kopírovat předmět">📋 Předmět</button>` : ''}
      <button class="btn btn-sm btn-ghost sfa-card-btn" onclick="SFAModule._copyEmail(${m.id}); event.stopPropagation()" title="Kopírovat tělo emailu">📋 Email</button>
      <a class="btn btn-sm btn-secondary sfa-card-btn" href="${buildMailto(m)}" title="Otevřít v Outlooku – předmět i tělo jsou předvyplněny" onclick="event.stopPropagation()">📤 Outlook</a>
    </div>
  </div>
  <pre class="sfa-email-text" id="sfa-email-${m.id}">${esc(m.aiEmail)}</pre>
</div>`;
  }

  function statusBadgeHtml(status) {
    const map = {
      draft:      ['sfa-badge-draft',      '○ Nevygenerováno'],
      generating: ['sfa-badge-generating', '⏳ Generuji…'],
      done:       ['sfa-badge-done',       '✅ Hotovo'],
    };
    const [cls, label] = map[status] || map.draft;
    return `<span class="sfa-status-badge ${cls}">${label}</span>`;
  }

  function updateActionBar() {
    const doneCount = meetings.filter(m => m.status === 'done').length;
    const assembleBtn = document.getElementById('sfaAssembleBtn');
    if (assembleBtn) assembleBtn.disabled = false;
    const countBadge = document.getElementById('sfaDoneCount');
    if (countBadge) countBadge.textContent = `${doneCount}/${meetings.length}`;
    // Generování zápisů jen v režimu "Uzavřít schůzku"
    const genAllBtn = document.getElementById('sfaGenerateAllBtn');
    if (genAllBtn) genAllBtn.style.display = sfaMode === 'new' ? 'none' : '';
  }

  /* ══════════════════════════════════════════
     AI GENERATION
  ══════════════════════════════════════════ */
  const SFA_SYSTEM = `Jsi asistent B2B obchodního zástupce Jakuba Sedláčka z O2 Czech Republic.
Tvým úkolem je napsat profesionální zápis ze schůzky ve formátu e-mailu.
E-mail píšeš jako by ho psal Jakub Sedláček dané kontaktní osobě.
Tón: profesionální, ale přátelský — B2B telecom styl O2.

Struktura emailu:
1. Oslovení: "Dobrý den [jméno],"
2. Krátké shrnutí setkání (1–2 věty)
3. Co bylo projednáno — stručné odrážky
4. Dohodnuté kroky a termíny — odrážky s konkrétními daty
5. Závěrečná věta s nabídkou dalšího kontaktu

PODPIS — přesně takto, beze změny:
S pozdravem a přáním pěkného dne

Jakub Sedláček | O2 Czech Republic a.s.
Account Manager
Za Brumlovkou 266/2 140 22 Praha 4 - Michle
M +420 604 164 542 | jakub.sedlacek@o2.cz
www.mojeo2.cz

Výstup MUSÍ začínat PŘESNĚ TAKTO (první řádek bez mezer před ním):
PŘEDMĚT: [stručný předmět e-mailu, max 60 znaků]

[prázdný řádek, pak tělo e-mailu od oslovení po podpis]

Žádný jiný text nesmí předcházet řádku "PŘEDMĚT:". Žádné uvozovky, žádné markdown bloky.`;

  function buildUserMessage(m) {
    const lines = [];
    lines.push(`Kontaktní osoba: ${m.contact || '(neuvedeno)'}`);
    lines.push(`Společnost: ${m.company || '(neuvedeno)'}`);
    if (m.ico) lines.push(`IČ: ${m.ico}`);
    if (m.address) lines.push(`Adresa sídla: ${m.address}`);
    if (m.datetime) lines.push(`Datum schůzky: ${m.datetime}`);
    if (m.discussed) {
      lines.push('');
      lines.push('Co bylo projednáno:');
      lines.push(m.discussed);
    }
    if (m.nextSteps) {
      lines.push('');
      lines.push('Dohodnuté kroky / next steps:');
      lines.push(m.nextSteps);
    }
    if (m.deadlines) {
      lines.push('');
      lines.push('Termíny a závazky:');
      lines.push(m.deadlines);
    }
    return lines.join('\n');
  }

  async function generateOne(id) {
    flushForm(id);
    const m = meetings.find(m => m.id === id);
    if (!m) return;

    if (!m.contact || !m.company) {
      App.showToast('Vyplňte alespoň kontaktní osobu a název společnosti', 'warning');
      return;
    }

    m.status = 'generating';
    renderMeetings();

    try {
      const resp = await fetch('/api/ai', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          systemPrompt: SFA_SYSTEM,
          userMessage:  buildUserMessage(m),
          maxTokens:    1024,
        }),
      });

      // Read as text first — if response is HTML (misconfigured server), gives clear error
      const text = await resp.text();
      let data;
      try {
        data = JSON.parse(text);
      } catch {
        console.error('[SFA] Non-JSON response:', text.slice(0, 200));
        throw new Error(`Server vrátil neplatnou odpověď (${resp.status}). Zkontrolujte Netlify → Functions.`);
      }

      if (!resp.ok || data.error) throw new Error(data.error || `HTTP ${resp.status}`);

      // Parse subject line (PŘEDMĚT: ...) from AI response
      const rawContent = data.content || '';
      const subjMatch  = rawContent.match(/^P[ŘR]EDM[ĚE]T:\s*(.+?)(?:\r?\n|$)/i);
      if (subjMatch) {
        m.subject = subjMatch[1].trim();
        m.aiEmail = rawContent.replace(/^P[ŘR]EDM[ĚE]T:\s*.+?\r?\n\s*\r?\n?/i, '').trim();
      } else {
        m.subject = '';
        m.aiEmail = rawContent;
      }
      m.status  = 'done';
      saveToHistory(m);   // remember company + contact for autocomplete
      App.showToast('✅ Zápis vygenerován', 'success');
    } catch (err) {
      console.error('[SFA] generate error:', err);
      m.status = 'draft';
      App.showToast('Chyba generování: ' + err.message, 'error');
    }

    saveDrafts();
    renderMeetings();
  }

  async function generateAll() {
    // Flush all forms first
    meetings.forEach(m => flushForm(m.id));

    const pending = meetings.filter(m => m.status !== 'done');
    if (!pending.length) {
      App.showToast('Všechny záznamy jsou už vygenerovány', 'info');
      return;
    }

    for (const m of pending) {
      await generateOne(m.id);
    }

    App.showToast(`✅ Hotovo — ${meetings.filter(m => m.status === 'done').length} zápisů`, 'success');
  }

  /* ══════════════════════════════════════════
     ARES / REJSTŘÍK LOOKUP
  ══════════════════════════════════════════ */
  function aresLookup(id) {
    const ico = document.getElementById(`sfa-ico-${id}`)?.value.trim();
    if (!ico || ico.length < 6) return;
    _ares(id);
  }

  async function _ares(id) {
    const icoInput     = document.getElementById(`sfa-ico-${id}`);
    const hint         = document.getElementById(`sfa-aresHint-${id}`);
    const linksWrap    = document.getElementById(`sfa-aresLinks-${id}`);
    const companyInput = document.getElementById(`sfa-company-${id}`);
    const ico          = icoInput?.value.trim();
    if (!ico) return;

    if (hint) hint.textContent = '🔍 Hledám v rejstříku…';

    const addressInput = document.getElementById(`sfa-address-${id}`);

    // Helper: fill company + optional address from ARES result
    function fillCompany(name, address) {
      if (companyInput && !companyInput.value.trim()) companyInput.value = name;
      if (address && addressInput && !addressInput.value.trim()) addressInput.value = address;
      if (hint) hint.textContent = address ? `✓ ${name} · ${address}` : `✓ ${name}`;
      if (linksWrap) linksWrap.classList.add('hidden');
      flushForm(id);
    }

    // Helper: show fallback search links
    function showFallback() {
      if (hint) hint.textContent = 'Automatické doplnění selhalo — vyhledejte ručně:';
      if (linksWrap) {
        linksWrap.innerHTML = `
          <a class="sfa-ares-link" href="https://or.justice.cz/ias/ui/rejstrik-$firma?ico=${encodeURIComponent(ico)}" target="_blank" rel="noopener">⚖️ Justice.cz</a>
          <a class="sfa-ares-link" href="https://ares.gov.cz/ekonomicke-subjekty?ico=${encodeURIComponent(ico)}" target="_blank" rel="noopener">🏛️ ARES web</a>
          <a class="sfa-ares-link" href="https://www.google.com/search?q=${encodeURIComponent(ico + ' IČO firma')}" target="_blank" rel="noopener">🔍 Google</a>`;
        linksWrap.classList.remove('hidden');
      }
    }

    function extractAddress(d) {
      return d?.sidlo?.textovaAdresa || d?.sidlo?.nadpisAdresy || '';
    }

    // Attempt 1: direct ARES REST API (works in some browser/CORS configs)
    try {
      const r = await fetch(
        `https://ares.gov.cz/ekonomicke-subjekty-v-be/rest/ekonomicke-subjekty/${ico}`,
        { headers: { Accept: 'application/json' }, signal: AbortSignal.timeout(5000) }
      );
      if (r.ok) {
        const d = await r.json();
        if (d.obchodniJmeno) { fillCompany(d.obchodniJmeno, extractAddress(d)); return; }
      }
    } catch { /* CORS blocked or timeout — try proxy */ }

    // Attempt 2: API proxy
    try {
      const r = await fetch(`/api/ares?ico=${encodeURIComponent(ico)}`,
        { signal: AbortSignal.timeout(6000) });
      const text = await r.text();
      let d;
      try { d = JSON.parse(text); } catch { d = {}; }
      if (d.obchodniJmeno) { fillCompany(d.obchodniJmeno, extractAddress(d)); return; }
    } catch { /* proxy also unavailable */ }

    // Fallback: show manual search links
    showFallback();
  }

  /* ══════════════════════════════════════════
     ICS / OUTLOOK CALENDAR EXPORT
  ══════════════════════════════════════════ */
  function dtDisplayToICS(v) {
    // "10.3.2026 14:00" → "20260310T140000"
    if (!v) return null;
    const match = v.match(/(\d{1,2})[.\-\/](\d{1,2})[.\-\/](\d{4})[,\s]+(\d{2}):(\d{2})/);
    if (!match) return null;
    const [, day, mon, year, hh, mm] = match;
    return `${year}${mon.padStart(2,'0')}${day.padStart(2,'0')}T${hh}${mm}00`;
  }

  function addOneHour(icsdt) {
    if (!icsdt) return null;
    const hh = parseInt(icsdt.slice(9, 11), 10);
    const newHH = String((hh + 1) % 24).padStart(2, '0');
    return icsdt.slice(0, 9) + newHH + icsdt.slice(11);
  }

  function escICS(s) {
    return String(s || '').replace(/\\/g, '\\\\').replace(/;/g, '\\;').replace(/,/g, '\\,').replace(/\n/g, '\\n');
  }

  function buildVEVENT(m) {
    const dtStart = m.datetime ? dtDisplayToICS(m.datetime) : null;
    const dtEnd   = dtStart ? addOneHour(dtStart) : null;
    const subject = m.subject || `O2 Czech Republic \u2013 ${m.company || 'Schůzka'}`;
    const uid     = `o2-sfa-${Date.now()}-${m.id}@o2toolkit`;
    const now     = new Date().toISOString().replace(/[-:]/g, '').replace(/\..+/, '') + 'Z';
    const descParts = [];
    if (m.contact) descParts.push('Kontakt: ' + m.contact);
    if (m.ico)     descParts.push('IČ: ' + m.ico);
    return [
      'BEGIN:VEVENT',
      `UID:${uid}`,
      `DTSTAMP:${now}`,
      dtStart ? `DTSTART:${dtStart}` : null,
      dtEnd   ? `DTEND:${dtEnd}`     : null,
      `SUMMARY:${escICS(subject)}`,
      m.address       ? `LOCATION:${escICS(m.address)}`                  : null,
      descParts.length ? `DESCRIPTION:${escICS(descParts.join('\\n'))}` : null,
      'ORGANIZER;CN=Jakub Sedláček:mailto:jakub.sedlacek@o2.cz',
      'END:VEVENT',
    ].filter(Boolean).join('\r\n');
  }

  function wrapVCALENDAR(events) {
    return [
      'BEGIN:VCALENDAR',
      'VERSION:2.0',
      'PRODID:-//O2 Toolkit//SFA Generator//CS',
      'CALSCALE:GREGORIAN',
      'METHOD:REQUEST',
      ...events,
      'END:VCALENDAR',
    ].join('\r\n');
  }

  function triggerICSDownload(content, filename) {
    const blob = new Blob([content], { type: 'text/calendar;charset=utf-8' });
    const url  = URL.createObjectURL(blob);
    const a    = document.createElement('a');
    a.href     = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }

  function _downloadICS(id) {
    flushForm(id);
    const m = meetings.find(x => x.id === id);
    if (!m) return;
    if (!m.datetime) {
      App.showToast('Nejprve vyplňte datum a čas schůzky', 'warning');
      return;
    }
    const content  = wrapVCALENDAR([buildVEVENT(m)]);
    const safeName = (m.company || 'schuze').replace(/[^\w\-]/g, '-');
    triggerICSDownload(content, `schuze-${safeName}.ics`);
    App.showToast('📅 Schůzka exportována — otevřete .ics soubor v Outlooku', 'success');
  }

  function _downloadAllICS() {
    meetings.forEach(m => flushForm(m.id));
    const withDt = meetings.filter(m => m.datetime);
    if (!withDt.length) {
      App.showToast('Žádná schůzka nemá vyplněné datum', 'warning');
      return;
    }
    const content = wrapVCALENDAR(withDt.map(m => buildVEVENT(m)));
    triggerICSDownload(content, 'schuzky-o2.ics');
    App.showToast(`📅 ${withDt.length} schůzek exportováno do Outlooku`, 'success');
  }

  /* ══════════════════════════════════════════
     SFA PROMPT ASSEMBLY
  ══════════════════════════════════════════ */
  const RULE_HEADER = `OBECNÉ PRAVIDLO PRO VŠECHNY SCHŮZKY:
⚠️ Pole "Týká se" v SFA NIKDY neupravuj ani nemažeš – je předvyplněno systémem a musí zůstat zachováno beze změny.`;

  const SEPARATOR = '─────────────────────────────';

  function assembleSFAPrompt() {
    const parts = [RULE_HEADER, ''];

    meetings.forEach((m, idx) => {
      const n      = idx + 1;
      const online = m.meetingType === 'online';

      parts.push(SEPARATOR);

      if (sfaMode === 'new') {
        // ── NEW MEETING mode ──
        parts.push(`SCHŮZKA ${n}${m.company ? ': ' + m.company : ''} [NOVÁ SCHŮZKA — bude teprve proběhnout]`);
        parts.push('');
        parts.push(`1. Otevři SFA, vyhledej společnost dle IČ: ${m.ico || '(doplňte IČ)'}`);
        parts.push(`2. Vytvoř novou schůzku${m.datetime ? ` — nastav datum zahájení: ${m.datetime}` : ''}`);
        parts.push(`3. Povinný účastník: vyhledej dle IČ (${m.ico || '?'}) a vyber: ${m.contact || '(doplňte jméno)'}`);
        parts.push(`4. Předmět: "${m.subject || `O2 Czech Republic – ${m.company || '(doplňte název)'}` }"`);
        if (online) {
          parts.push(`5. Adresa schůzky: Schůzka Microsoft Teams (zapiš přesně takto)`);
          parts.push(`6. ☑️ Zaškrtni políčko „Online schůzka" v záhlaví záznamu schůzky`);
          parts.push(`7. ⚠️ ZASTAV SE — zeptej se uživatele: „Schůzka ${n} (${m.company || '?'}) připravena — smím uložit?" — počkej na potvrzení`);
          parts.push(`8. Po potvrzení: Ulož a zavři zánam — NEKLIKEJ „Dokonči schůzku", schůzka teprve proběhne`);
          parts.push(`9. DŮLEŽITÉ – pole "Týká se" NEMAZAT ani NEUPRAVOVAT — předvyplněno systémem SFA`);
        } else {
          const adresa = m.address
            ? `5. Adresa sídla: ${m.address}`
            : `5. Adresa: vyhledej sídlo na internetu dle IČ ${m.ico || '(IČ)'} a doplň`;
          parts.push(adresa);
          parts.push(`6. ⚠️ ZASTAV SE — zeptej se uživatele: „Schůzka ${n} (${m.company || '?'}) připravena — smím uložit?" — počkej na potvrzení`);
          parts.push(`7. Po potvrzení: Ulož a zavři záznam — NEKLIKEJ „Dokonči schůzku", schůzka teprve proběhne`);
          parts.push(`8. DŮLEŽITÉ – pole "Týká se" NEMAZAT ani NEUPRAVOVAT — předvyplněno systémem SFA`);
        }
      } else {
        // ── CLOSE MEETING mode ──
        const popis = m.aiEmail || '(zápis zatím nevygenerován)';
        parts.push(`SCHŮZKA ${n}${m.company ? ': ' + m.company : ''}${online ? ' [ONLINE]' : ''}`);
        parts.push('');
        parts.push(`1. Otevři SFA, vyhledej společnost dle IČ: ${m.ico || '(doplňte IČ)'}`);
        parts.push(`2. Vytvoř novou schůzku${m.datetime ? ` — nastav datum a čas: ${m.datetime}` : ''}`);
        parts.push(`3. Povinný účastník: vyhledej dle IČ (${m.ico || '?'}) a vyber: ${m.contact || '(doplňte jméno)'}`);
        parts.push(`4. Předmět: "O2 Czech Republic – ${m.company || '(doplňte název)'}"`);
        if (online) {
          parts.push(`5. Adresa schůzky: Schůzka Microsoft Teams (zapiš přesně takto)`);
          parts.push(`6. ☑️ Zaškrtni políčko „Online schůzka" v záhlaví záznamu schůzky`);
          parts.push(`7. Popis:`);
          parts.push('');
          parts.push(popis);
          parts.push('');
          parts.push(`8. ⚠️ ZASTAV SE — zeptej se uživatele: „Schůzka ${n} (${m.company || '?'}) je připravena, smím ji dokončit?" — počkej na potvrzení (Ano / OK / Pokračuj)`);
          parts.push(`9. Po potvrzení: Ulož schůzku a dokonči ji — klikni „Dokonči schůzku" / „Schůzka proběhla"`);
          parts.push(`10. DŮLEŽITÉ – pole "Týká se" NEMAZAT ani NEUPRAVOVAT — předvyplněno systémem SFA`);
        } else {
          const adresa = m.address
            ? `5. Adresa sídla: ${m.address}`
            : `5. Adresa: vyhledej sídlo na internetu dle IČ ${m.ico || '(IČ)'} a doplň`;
          parts.push(adresa);
          parts.push(`6. Popis:`);
          parts.push('');
          parts.push(popis);
          parts.push('');
          parts.push(`7. ⚠️ ZASTAV SE — zeptej se uživatele: „Schůzka ${n} (${m.company || '?'}) je připravena, smím ji dokončit?" — počkej na potvrzení (Ano / OK / Pokračuj)`);
          parts.push(`8. Po potvrzení: Ulož schůzku a dokonči ji — klikni „Dokonči schůzku" / „Schůzka proběhla"`);
          parts.push(`9. DŮLEŽITÉ – pole "Týká se" NEMAZAT ani NEUPRAVOVAT — předvyplněno systémem SFA`);
        }
      }
      parts.push('');
    });

    parts.push(SEPARATOR);
    return parts.join('\n');
  }

  function renderSFAPrompt() {
    meetings.forEach(m => flushForm(m.id));

    const notDone = meetings.filter(m => m.status !== 'done').length;
    if (notDone > 0) {
      App.showToast(`⚠️ ${notDone} schůzka(y) bez vygenerovaného zápisu — doplněn placeholder`, 'warning');
    }

    const prompt = assembleSFAPrompt();
    const ta = document.getElementById('sfaPromptOutput');
    if (ta) ta.value = prompt;

    const section = document.getElementById('sfaOutputSection');
    section?.classList.remove('hidden');
    setTimeout(() => section?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 60);

    if (notDone === 0) App.showToast('📋 SFA prompt připraven', 'success');
  }

  function copyPrompt() {
    const text = document.getElementById('sfaPromptOutput')?.value || '';
    if (!text) { App.showToast('Nejprve sestavte prompt', 'warning'); return; }
    if (navigator.clipboard) {
      navigator.clipboard.writeText(text).then(() => App.showToast('📋 Prompt zkopírován do schránky', 'success'));
    } else {
      const ta = document.getElementById('sfaPromptOutput');
      ta.select();
      document.execCommand('copy');
      App.showToast('📋 Zkopírováno', 'success');
    }
  }

  function _copyEmail(id) {
    const text = document.getElementById(`sfa-email-${id}`)?.textContent || '';
    if (navigator.clipboard) {
      navigator.clipboard.writeText(text).then(() => App.showToast('📋 Email zkopírován', 'success'));
    } else {
      App.showToast('Kopírování nepodporováno v tomto prohlížeči', 'warning');
    }
  }

  function _copySubject(id) {
    const m = meetings.find(x => x.id === id);
    if (!m?.subject) { App.showToast('Předmět není dostupný', 'warning'); return; }
    if (navigator.clipboard) {
      navigator.clipboard.writeText(m.subject).then(() => App.showToast('📋 Předmět zkopírován', 'success'));
    } else {
      App.showToast('Kopírování nepodporováno v tomto prohlížeči', 'warning');
    }
  }

  async function _addToFocus(id) {
    flushForm(id);
    const m = meetings.find(x => x.id === id);
    if (!m || !m.nextSteps) { App.showToast('Nejprve vyplňte Next Steps', 'warning'); return; }
    try {
      const items = await App.db.getFocusItems();
      const first = m.nextSteps.split('\n')[0].replace(/^[•\-\*]\s*/, '').slice(0, 100);
      items.unshift({
        id:        String(Date.now() + Math.random()),
        text:      `[${m.company || 'schůzka'}] ${first}`,
        priority:  'high',
        category:  'followup',
        dueDate:   '',
        done:      false,
        doneAt:    null,
        createdAt: Date.now(),
      });
      await App.db.saveFocusItems(items);
      App.showToast('➕ Přidáno do Focus listu na dashboardu', 'success');
    } catch {
      App.showToast('Chyba při ukládání do Focus listu', 'error');
    }
  }

  /* ══════════════════════════════════════════
     DRAFT PERSISTENCE
  ══════════════════════════════════════════ */
  function saveDrafts() {
    try {
      // Persist company to history whenever company is filled (contact optional)
      meetings.forEach(m => { if (m.company) saveToHistory(m); });
      localStorage.setItem(DRAFT_KEY, JSON.stringify({ meetings, nextId }));
    } catch { /* quota exceeded — ignore */ }
  }

  function loadDrafts() {
    try {
      const raw = localStorage.getItem(DRAFT_KEY);
      if (!raw) return;
      const data = JSON.parse(raw);
      if (Array.isArray(data.meetings) && data.meetings.length) {
        meetings = data.meetings;
        nextId   = data.nextId ?? (Math.max(...meetings.map(m => m.id)) + 1);
      }
    } catch { /* corrupt data — ignore */ }
  }

  /* ══════════════════════════════════════════
     MODE TOGGLE
  ══════════════════════════════════════════ */
  function _setMode(mode) {
    if (sfaMode === mode) return;
    sfaMode = mode;
    // Flush all forms first so data is preserved
    meetings.forEach(m => flushForm(m.id));
    renderMeetings();
    document.getElementById('sfaOutputSection')?.classList.add('hidden');
  }

  /* ══════════════════════════════════════════
     PUBLIC API
  ══════════════════════════════════════════ */
  return {
    init,
    _toggle:          toggleCollapse,
    _remove:          removeMeeting,
    _ares,
    _generateOne:     generateOne,
    _copyEmail,
    _copySubject,
    _addToFocus,
    _setMode,
    _downloadICS,
    _downloadAllICS,
  };
})();

/* ════════════════════════════════════════════════
   tickets.js — O2 Arena Tickets (full spec)
   Sekce 1: Upload + parsování Excel 2026
   Sekce 2: Tabulka akcí s obsazeností
   Sekce 3: Generátor pozvánky (AI)
   Sekce 4: Historie lístků (grouped by customer)
   ════════════════════════════════════════════════ */

window.TicketsModule = (() => {
  'use strict';

  let initialized = false;
  let parsedRows  = [];   // all rows from uploaded Excel (2026 sheet)
  let uploadMeta  = null; // { filename, rowCount, uploadedAt, excelMeta }
  let currentFilter = '';

  const AM_TERMS = ['sedl'];

  /* ══════════════════════════════════════════
     UTILITIES
  ══════════════════════════════════════════ */
  function norm(v) {
    return String(v ?? '').toLowerCase()
      .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
      .replace(/\s+/g, ' ').trim();
  }

  function escHtml(s) { return App.escHtml(s); }

  function normDate(v) {
    if (!v) return '';
    if (v instanceof Date) return v.toLocaleDateString('cs-CZ');
    // Normalize multi-space to single space, keep date + time readable
    return String(v).trim().replace(/\s{2,}/g, ' ');
  }

  function parseCzechDate(s) {
    if (!s) return null;
    // Try formats: "14.3.2026 18:00", "14.03.2026", "2026-03-14"
    const m = String(s).match(/(\d{1,2})[.\-\/](\d{1,2})[.\-\/](\d{4})/);
    if (m) return new Date(+m[3], +m[2] - 1, +m[1]);
    const iso = String(s).match(/(\d{4})[.\-\/](\d{1,2})[.\-\/](\d{1,2})/);
    if (iso) return new Date(+iso[1], +iso[2] - 1, +iso[3]);
    return null;
  }

  function isFuture(dateStr) {
    const d = parseCzechDate(dateStr);
    return d ? d >= new Date() : true;
  }

  function dedupKey(event, company, date, count) {
    const d = normDate(date).slice(0, 10);
    return [norm(event), norm(company), d, String(count)].join('|');
  }

  /* ══════════════════════════════════════════
     COLUMN DETECTION
  ══════════════════════════════════════════ */
  const COL_NAMES = {
    event:    ['název akce', 'nazev akce'],
    date:     ['datum a čas akce', 'datum a cas akce', 'datum', 'date'],
    status:   ['schváleno/neschváleno/náhradník', 'schvaleno/neschvaleno/nahradnik', 'stav', 'status'],
    firma:    ['zákazník', 'zakaznik', 'firma', 'company'],
    kontakt:  ['ko', 'kontakt'],
    am:       ['řadatel / am', 'radatel / am', 'řadatel/am', 'radatel/am', 'am'],
    count:    ['počet vstupenek', 'pocet vstupenek', 'počet', 'pocet'],
  };

  const FALLBACK_IDX = { date: 0, status: 2, event: 3, am: 11, count: 16, kontakt: 5, firma: 6 };

  function detectCols(headers) {
    const result = {};
    Object.entries(COL_NAMES).forEach(([field, aliases]) => {
      let found = -1;
      // Pass 1: exact match only (safest)
      for (let i = 0; i < headers.length && found < 0; i++) {
        const h = norm(String(headers[i] ?? ''));
        if (aliases.some(a => h === norm(a))) { found = i; }
      }
      // Pass 2: substring match, but alias must cover >50% of header to avoid false positives
      for (let i = 0; i < headers.length && found < 0; i++) {
        const h = norm(String(headers[i] ?? ''));
        if (!h || h.length < 2) continue;
        if (aliases.some(a => { const na = norm(a); return h.includes(na) && na.length > h.length * 0.5; })) {
          found = i;
        }
      }
      result[field] = found >= 0 ? found : FALLBACK_IDX[field] ?? -1;
    });
    console.log('[Tickets] detectCols:', result);
    return result;
  }

  /* ══════════════════════════════════════════
     STATUS HELPERS
  ══════════════════════════════════════════ */
  function statusNorm(s) { return norm(s); }
  function isApproved(s) { const n = statusNorm(s); return n === 'schváleno' || n === 'schvaleno' || n === 'ano'; }
  function isPending(s)  { const n = statusNorm(s); return n.includes('ceka') || n.includes('čeká') || n.includes('nahradnik') || n.includes('náhradník'); }

  function statusLabel(s) {
    if (isApproved(s)) return '✅ Schváleno';
    if (isPending(s)) {
      const n = statusNorm(s);
      return n.includes('nahradnik') ? '🔄 Náhradník' : '⏳ Čeká';
    }
    const n = statusNorm(s);
    if (n === 'neschváleno' || n === 'neschvaleno' || n === 'ne') return '✗ Zamítnuto';
    return s || '–';
  }
  function statusClass(s) {
    if (isApproved(s)) return 'status-schváleno';
    if (isPending(s)) {
      const n = statusNorm(s);
      return n.includes('nahradnik') ? 'status-nahradnik' : 'status-čeká';
    }
    return 'status-zamítnuto';
  }

  function isJakub(amStr) {
    const n = norm(amStr);
    return AM_TERMS.some(t => n.includes(t));
  }

  function isSladek(amStr) {
    const n = norm(amStr);
    return n.includes('sladek') || n.includes('kasinsky') || n.includes('kasin');
  }

  /* ══════════════════════════════════════════
     EXCEL PARSING — only 2026 sheet
  ══════════════════════════════════════════ */
  function findSheet2026(wb) {
    const target = wb.SheetNames.find(n => n.includes('2026'));
    return target ? wb.Sheets[target] : wb.Sheets[wb.SheetNames[0]];
  }

  function parseWorkbook(wb) {
    const ws = findSheet2026(wb);
    if (!ws) return [];

    // Use type:'array' (no cellDates) to avoid date serial number conversion
    const raw = XLSX.utils.sheet_to_json(ws, { header: 1, defval: '', blankrows: false });
    if (!raw.length) return [];

    // Find FIRST header row (has 'Název akce')
    let headerRow = 0;
    for (let i = 0; i < Math.min(raw.length, 5); i++) {
      const s = raw[i].map(c => norm(String(c))).join(' ');
      if (s.includes('nazev akce') || (s.includes('nazev') && s.includes('schvaleno'))) { headerRow = i; break; }
    }

    const headers = raw[headerRow];
    const ci = detectCols(headers);

    // PASS 1 — Pre-scan: collect ALL event dates and display names before processing nominations.
    // This is necessary because the date row (col A) comes AFTER the first nomination row in
    // each event block ("Rozdáno:" is the first row, date is on the second row).
    const eventDates      = {};
    const eventNamesByKey = {};

    for (let i = headerRow + 1; i < raw.length; i++) {
      const row      = raw[i];
      const eventStr = String(ci.event >= 0 ? row[ci.event] : '').trim();
      const eventKey = norm(eventStr);

      // Track display name (first occurrence wins)
      if (eventStr && eventKey !== 'nazev akce' && !eventNamesByKey[eventKey]) {
        eventNamesByKey[eventKey] = eventStr;
      }

      // Collect date — skip "Rozdáno:", "Doprovod O2:", repeated header text
      const dateStr = String(ci.date >= 0 ? row[ci.date] : '').trim();
      if (dateStr &&
          !dateStr.includes('Rozd') &&
          !dateStr.includes('Doprovod') &&
          !norm(dateStr).startsWith('datum') &&
          eventStr && eventKey !== 'nazev akce' &&
          !eventDates[eventKey]               // first valid date wins
      ) {
        eventDates[eventKey] = normDate(dateStr);
      }
    }

    // PASS 2 — Process nomination rows using the pre-collected dates
    const rows = [];

    for (let i = headerRow + 1; i < raw.length; i++) {
      const row = raw[i];

      const rawEvent = ci.event >= 0 ? row[ci.event] : '';
      const eventStr = String(rawEvent ?? '').trim();
      const eventKey = norm(eventStr);

      // Skip empty event names OR repeated header rows (contain 'Název akce')
      if (!eventStr) continue;
      if (eventKey === 'nazev akce') continue;

      const status  = String(row[ci.status]  ?? '').trim();
      const am      = String(row[ci.am]      ?? '').trim();
      const firma   = String(row[ci.firma]   ?? '').trim();
      const kontakt = String(row[ci.kontakt] ?? '').trim();
      const countRaw = row[ci.count] ?? '';
      const count   = Math.max(1, parseInt(String(countRaw).replace(/[^0-9]/g, '')) || 0);

      // Skip rows with no meaningful data
      if (!status && !firma && !kontakt) continue;

      // Skip repeated header rows (firma='Zákazník', kontakt='KO', status='Schváleno/Neschváleno/...')
      if (norm(firma) === 'zakaznik' || norm(kontakt) === 'ko') continue;
      if (norm(status).startsWith('schvaleno/neschvaleno')) continue;

      const eventDate = eventDates[eventKey] || '';

      rows.push({
        event_name:    eventStr,
        event_date:    eventDate,
        kontakt,
        firma,
        tickets_count: count,
        status,
        am,
        dedup_key:     dedupKey(eventStr, firma, eventDate, count),
        rowIndex:      i,
      });
    }

    // Add placeholder rows for events that exist in the file but have no nominations yet
    // (event header rows with only a name — e.g., new 2026 events)
    const seenEventKeys = new Set(rows.map(r => norm(r.event_name)));
    Object.entries(eventDates).forEach(([normKey, date]) => {
      if (!seenEventKeys.has(normKey) && eventNamesByKey[normKey]) {
        rows.push({
          event_name:    eventNamesByKey[normKey],
          event_date:    date,
          kontakt:       '',
          firma:         '',
          tickets_count: 0,
          status:        '',
          am:            '',
          dedup_key:     `__placeholder_${normKey}`,
          rowIndex:      -1,
        });
      }
    });

    return rows;
  }

  /* ══════════════════════════════════════════
     OCCUPANCY PER EVENT
  ══════════════════════════════════════════ */
  const MAX_TICKETS_PER_EVENT = 12;

  function calcEventStats(rows) {
    const stats = {};
    rows.forEach(r => {
      const k = norm(r.event_name);
      if (!stats[k]) stats[k] = {
        name: r.event_name, date: r.event_date || '',
        approvedTix: 0, totalTix: 0, cap: MAX_TICKETS_PER_EVENT,
        jakubStatus: '', jakubTix: 0,
      };
      // Update date if we now have one and didn't before
      if (r.event_date && !stats[k].date) stats[k].date = r.event_date;
      stats[k].totalTix += r.tickets_count;
      // Sládek (manager) nominations are always treated as approved
      if (isApproved(r.status) || isSladek(r.am)) stats[k].approvedTix += r.tickets_count;
      if (isJakub(r.am)) {
        // Empty status = nomination submitted but not yet processed → treat as "Čeká"
        const effectiveStatus = r.status || 'Čeká';
        if (!stats[k].jakubStatus || isApproved(effectiveStatus)) {
          stats[k].jakubStatus = effectiveStatus;
          stats[k].jakubTix = r.tickets_count;
        }
      }
    });
    return stats;
  }

  function occupancyColor(pct) {
    if (pct >= 100) return '#ef4444';
    if (pct >= 80)  return '#f97316';
    if (pct >= 50)  return '#f59e0b';
    return '#10b981';
  }

  /* ══════════════════════════════════════════
     INIT
  ══════════════════════════════════════════ */
  function init() {
    if (initialized) { loadHistory(); return; }
    initialized = true;

    setupUpload();
    setupFilters();
    setupInviteBtn();
    setupManualAddBtn();
    setupNominations();
    loadHistory();
    document.getElementById('resetTicketsBtn')?.addEventListener('click', resetTicketsData);
    document.getElementById('clearAllHistoryBtn')?.addEventListener('click', clearAllHistory);

    // Stats row (inject into toolbar if not exists)
    if (!document.getElementById('ticketStatsBar')) {
      const statsHtml = `<div id="ticketStatsBar" class="ticket-stats-bar hidden">
        <span class="stat-chip" id="statEvents">0 akcí</span>
        <span class="stat-chip stat-success" id="statApproved">0 schváleno</span>
        <span class="stat-chip stat-warning" id="statPending">0 čeká</span>
        <span class="stat-chip stat-info" id="statTickets">0 lístků</span>
        <span class="stat-chip stat-gray" id="statMeta"></span>
      </div>`;
      document.getElementById('tab-tickets-table')?.insertAdjacentHTML('afterbegin', statsHtml);
    }
  }

  /* ══════════════════════════════════════════
     SEKCE 1 — UPLOAD
  ══════════════════════════════════════════ */
  function setupUpload() {
    const input = document.getElementById('ticketsUpload');
    if (!input) return;
    input.addEventListener('change', async (e) => {
      const file = e.target.files[0];
      if (!file) return;
      if (!window.XLSX) { App.showToast('SheetJS se nenačetlo', 'error'); return; }

      App.showToast('📂 Načítám Excel 2026…', 'info');
      const reader = new FileReader();
      reader.onload = async (ev) => {
        try {
          const wb = XLSX.read(new Uint8Array(ev.target.result), { type: 'array' });
          const rows = parseWorkbook(wb);

          if (!rows.length) {
            App.showToast('Žádná data v listu 2026', 'warning'); return;
          }

          parsedRows = rows;
          // Read Excel metadata from wb.Props
          let excelMeta = '';
          if (wb.Props) {
            const author = wb.Props.LastAuthor || wb.Props.Author || '';
            const modified = wb.Props.ModifiedDate ? new Date(wb.Props.ModifiedDate) : null;
            const parts = [];
            if (author) parts.push(author);
            if (modified) parts.push(modified.toLocaleString('cs-CZ', { day:'2-digit', month:'2-digit', year:'numeric', hour:'2-digit', minute:'2-digit' }));
            excelMeta = parts.join(', ');
          }
          uploadMeta = { filename: file.name, rowCount: rows.length, uploadedAt: new Date(), excelMeta };

          renderStats(rows);
          renderEventsTable(rows, '');
          populateNomEventSelect();
          document.getElementById('ticketStatsBar')?.classList.remove('hidden');

          // Auto-import history
          const jakubApproved = rows.filter(r =>
            isApproved(r.status) && isJakub(r.am) && r.tickets_count >= 1
          );

          if (jakubApproved.length) {
            const added = await importToHistory(jakubApproved, true);
            App.showToast(`⚡ ${added} nominací přidáno do historie`, 'success');
            loadHistory();
          } else {
            App.showToast(`Načteno ${rows.length} řádků. Žádné Jakubovy schválené nominace pro 2026.`, 'info');
          }
        } catch (err) {
          console.error(err);
          App.showToast('Chyba parsování: ' + err.message, 'error');
        }
      };
      reader.readAsArrayBuffer(file);
      input.value = '';
    });
  }

  function renderStats(rows) {
    const eventKeys  = new Set(rows.map(r => norm(r.event_name)));
    const jakubRows  = rows.filter(r => isJakub(r.am));
    const approved   = jakubRows.filter(r => isApproved(r.status)).length;
    const pending    = jakubRows.filter(r => isPending(r.status) || !r.status).length;
    const totalTix   = jakubRows.filter(r => isApproved(r.status))
                           .reduce((s, r) => s + r.tickets_count, 0);

    document.getElementById('statEvents')?.replaceChildren();
    setText('statEvents',   `${eventKeys.size} akcí`);
    setText('statApproved', `${approved} schváleno`);
    setText('statPending',  `${pending} čeká`);
    setText('statTickets',  `${totalTix} lístků`);
    if (uploadMeta) {
      const timeStr = uploadMeta.uploadedAt.toLocaleTimeString('cs-CZ', { hour: '2-digit', minute: '2-digit' });
      const metaDetail = uploadMeta.excelMeta ? `úprava: ${uploadMeta.excelMeta}` : `nahráno ${timeStr}`;
      setText('statMeta', `📎 ${uploadMeta.filename} · ${metaDetail}`);
    }
  }

  function setText(id, val) {
    const el = document.getElementById(id);
    if (el) el.textContent = val;
  }

  /* ══════════════════════════════════════════
     SEKCE 2 — TABULKA AKCÍ
  ══════════════════════════════════════════ */
  function setupFilters() {
    const search = document.getElementById('ticketsSearch');
    search?.addEventListener('input', () => renderEventsTable(parsedRows, currentFilter));
    document.querySelectorAll('.filter-chip').forEach(chip => {
      chip.addEventListener('click', () => {
        document.querySelectorAll('.filter-chip').forEach(c => c.classList.remove('active'));
        chip.classList.add('active');
        currentFilter = chip.dataset.filter || '';
        renderEventsTable(parsedRows, currentFilter);
      });
    });
  }

  function renderEventsTable(rows, filter) {
    const tbody = document.getElementById('ticketsTableBody');
    if (!tbody) return;

    const stats = calcEventStats(rows);
    const searchQ = norm(document.getElementById('ticketsSearch')?.value || '');

    // Only show FUTURE events in table (past go to history)
    let events = Object.values(stats).filter(e => isFuture(e.date));

    // Apply status filter
    if (filter === 'Schváleno')  events = events.filter(e => isApproved(e.jakubStatus));
    if (filter === 'Čeká')       events = events.filter(e => isPending(e.jakubStatus));
    if (filter === 'Zamítnuto')  events = events.filter(e => !isApproved(e.jakubStatus) && !isPending(e.jakubStatus) && e.jakubStatus);

    // Search
    if (searchQ) events = events.filter(e => norm(e.name).includes(searchQ) || norm(e.date).includes(searchQ));

    if (!events.length) {
      tbody.innerHTML = '<tr><td colspan="5" class="empty-row">Žádné nadcházející akce odpovídají filtru</td></tr>';
      return;
    }

    tbody.innerHTML = events.map(ev => {
      const totalPct    = Math.min(100, ev.cap ? Math.round((ev.totalTix    / ev.cap) * 100) : 0);
      const approvedPct = Math.min(100, ev.cap ? Math.round((ev.approvedTix / ev.cap) * 100) : 0);
      const totalColor    = occupancyColor(totalPct);
      const approvedColor = occupancyColor(approvedPct);
      const totalEmoji    = totalPct >= 80 ? '🔴' : totalPct >= 50 ? '🟡' : '🟢';

      const jakubBadge = ev.jakubStatus
        ? `<span class="status-badge ${statusClass(ev.jakubStatus)}">${statusLabel(ev.jakubStatus)}</span>`
        : '<span class="status-badge status-none">– žádná</span>';

      // Stacked bar: green approved + orange rest-of-total
      const approvedWidth = approvedPct;
      const pendingWidth  = Math.max(0, totalPct - approvedPct);

      return `<tr>
        <td><strong>${escHtml(ev.name)}</strong></td>
        <td style="white-space:nowrap;font-size:13px">${escHtml(ev.date) || '<span style="color:var(--text-tertiary)">–</span>'}</td>
        <td>
          <div class="occ-cell">
            <div class="occ-bar-track">
              <div class="occ-bar-approved" style="width:${approvedWidth}%"></div>
              <div class="occ-bar-pending"  style="width:${pendingWidth}%" ></div>
            </div>
            <div class="occ-labels">
              <span class="occ-approved-num" title="Schváleno">✅ ${ev.approvedTix}</span>
              <span class="occ-sep">·</span>
              <span class="occ-total-num" title="Celkem přihlášeno">${totalEmoji} ${ev.totalTix}/${ev.cap}</span>
            </div>
          </div>
        </td>
        <td>${jakubBadge}</td>
        <td>
          <button class="btn btn-sm btn-primary nom-from-event-btn"
            data-event="${escHtml(ev.name)}" data-date="${escHtml(ev.date)}">📝 Nominovat</button>
        </td>
      </tr>`;
    }).join('');

    // Wire "Nominovat" buttons after DOM insertion
    tbody.querySelectorAll('.nom-from-event-btn').forEach(btn => {
      btn.addEventListener('click', () => openNominationFromEvent(btn.dataset.event, btn.dataset.date));
    });
  }

  function openNominationFromEvent(eventName, eventDate) {
    App.showModal({
      title: `📝 Nominace vstupenek`,
      size: 'lg',
      body: `
        <div style="background:var(--primary-light);border:1px solid var(--primary-mid);border-radius:var(--radius-sm);padding:.6rem .9rem;margin-bottom:1.1rem;display:flex;align-items:center;gap:.6rem">
          <span style="font-size:1.2rem">🎟️</span>
          <div>
            <div style="font-weight:600;font-size:14px">${escHtml(eventName)}</div>
            ${eventDate ? `<div style="font-size:12px;color:var(--text-secondary)">📅 ${escHtml(eventDate)}</div>` : ''}
          </div>
        </div>
        <div class="form-row">
          <div class="form-group">
            <label class="form-label">Kontaktní osoba (KO) *</label>
            <input type="text" id="quickNomKontakt" class="form-control" placeholder="Ing. Jan Novák">
          </div>
          <div class="form-group">
            <label class="form-label">Firma (zákazník) *</label>
            <input type="text" id="quickNomFirma" class="form-control" placeholder="ABC s.r.o.">
          </div>
        </div>
        <div class="form-row">
          <div class="form-group">
            <label class="form-label">OP (číslo obch. případu)</label>
            <input type="text" id="quickNomOP" class="form-control" placeholder="OP-7xxxxxxHA">
          </div>
          <div class="form-group">
            <label class="form-label">Telefon klienta</label>
            <input type="text" id="quickNomTelefon" class="form-control" placeholder="777 123 456">
          </div>
        </div>
        <div class="form-row">
          <div class="form-group">
            <label class="form-label">Pozice</label>
            <input type="text" id="quickNomPozice" class="form-control" placeholder="Jednatel / IT ředitel">
          </div>
          <div class="form-group">
            <label class="form-label">IČO</label>
            <input type="text" id="quickNomICO" class="form-control" placeholder="12345678" maxlength="8">
          </div>
        </div>
        <div class="form-row">
          <div class="form-group">
            <label class="form-label">Celkové výnosy klienta</label>
            <input type="text" id="quickNomVynosy" class="form-control" placeholder="150 000,-">
          </div>
          <div class="form-group" style="visibility:hidden"></div>
        </div>
        <div class="form-row">
          <div class="form-group">
            <label class="form-label">Počet vstupenek</label>
            <input type="number" id="quickNomCount" class="form-control" value="2" min="1" max="12">
          </div>
          <div class="form-group">
            <label class="form-label">Typ</label>
            <select id="quickNomTyp" class="form-control">
              <option value="Retence">Retence</option>
              <option value="Nový prodej">Nový prodej</option>
              <option value="Akvizice">Akvizice</option>
            </select>
          </div>
        </div>
        <div class="form-group">
          <label class="form-label">Specifické zdůvodnění</label>
          <textarea id="quickNomZduvodneni" class="form-control" rows="2" placeholder="Proč chci zákazníkovi lístky dát — konkrétní obchodní přínos..."></textarea>
        </div>`,
      footer: `
        <button class="btn btn-secondary" onclick="App.closeModal()">Zrušit</button>
        <button class="btn btn-primary" id="quickNomSaveBtn">✅ Přidat nominaci</button>`,
    });

    // Focus first field
    setTimeout(() => document.getElementById('quickNomKontakt')?.focus(), 100);

    document.getElementById('quickNomSaveBtn')?.addEventListener('click', () => {
      const kontakt = document.getElementById('quickNomKontakt')?.value.trim();
      const firma   = document.getElementById('quickNomFirma')?.value.trim();
      const count   = parseInt(document.getElementById('quickNomCount')?.value) || 2;
      const typ     = document.getElementById('quickNomTyp')?.value || 'Retence';
      const zduvod  = document.getElementById('quickNomZduvodneni')?.value.trim() || '';
      const op      = document.getElementById('quickNomOP')?.value.trim() || '';
      const tel     = document.getElementById('quickNomTelefon')?.value.trim() || '';
      const pozice  = document.getElementById('quickNomPozice')?.value.trim() || '';
      const ico     = document.getElementById('quickNomICO')?.value.trim() || '';
      const vynosy  = document.getElementById('quickNomVynosy')?.value.trim() || '';

      if (!kontakt || !firma) {
        App.showToast('Vyplňte kontaktní osobu a firmu', 'warning');
        return;
      }

      const nom = {
        id:          Date.now() + Math.random(),
        event_name:  eventName,
        event_date:  eventDate || '',
        op,
        kontakt,
        firma,
        pozice,
        ico,
        vynosy,
        typ,
        zduvodneni:  zduvod,
        telefon:     tel,
        count,
      };

      const noms = getNominations();
      noms.push(nom);
      saveNominations(noms);
      renderNominations();
      App.closeModal();
      App.showToast(`✅ Nominace přidána — ${firma}`, 'success');
    });
  }

  /* ─── Clear all ticket history ─── */
  function clearAllHistory() {
    const count = getHistory().length;
    if (!count) { App.showToast('Historie je již prázdná', 'info'); return; }
    if (!confirm(`Smazat VEŠKEROU historii lístků? (${count} záznamů)\n\nTato akce je nevratná.`)) return;
    if (!confirm('Opravdu smazat všechny záznamy? Tuto akci nelze vrátit.')) return;
    saveHistory([]);
    loadHistory();
    App.showToast('🗑️ Veškerá historie lístků smazána', 'success');
  }

  /* ─── Reset all tickets data ─── */
  function resetTicketsData() {
    if (!confirm('Resetovat data? Smažou se nahrané akce (historie a nominace zůstanou).')) return;
    parsedRows = [];
    uploadMeta = null;
    currentFilter = '';
    renderEventsTable([], '');

    // Reset stats chips
    setText('statEvents', '0 akcí');
    setText('statApproved', '0 schváleno');
    setText('statPending', '0 čeká');
    setText('statTickets', '0 lístků');
    setText('statMeta', '');
    document.getElementById('ticketStatsBar')?.classList.add('hidden');

    // Reset event selector
    const sel = document.getElementById('nomEventSel');
    if (sel) sel.innerHTML = '<option value="">-- Vyberte akci --</option>';

    // Reset filter chips
    document.querySelectorAll('.filter-chip').forEach(c => c.classList.remove('active'));
    document.querySelector('.filter-chip[data-filter=""]')?.classList.add('active');

    App.showToast('🔄 Data resetována. Nahrajte nový Excel.', 'info');
  }

  /* ══════════════════════════════════════════
     SEKCE 3 — GENERÁTOR POZVÁNKY
  ══════════════════════════════════════════ */
  const INVITE_SYSTEM = `Jsi asistent B2B obchodního zástupce Jakuba Sedláčka z O2 Czech Republic. Píšeš profesionální pozvánky na sportovní a kulturní akce v češtině. Styl: přátelský, bez nátlaku, zdůrazni exkluzivitu a osobní pozvání. Nikdy nezmiňuj obchodní podmínky ani produkty.
Výstup: první řádek začíná "Předmět: ...", pak prázdný řádek, pak tělo emailu (max 8 vět).
Podpis: Jakub Sedláček | O2 Czech Republic | Account Manager`;

  function setupInviteBtn() {
    document.getElementById('openInviteGenBtn')?.addEventListener('click', openInviteModal);
  }

  function getUniqueEventList() {
    const seen = new Map();
    parsedRows.forEach(r => {
      const k = norm(r.event_name);
      if (!seen.has(k)) seen.set(k, r);
    });
    return Array.from(seen.values());
  }

  function openInviteModal() {
    const events = getUniqueEventList();
    const opts = events.length
      ? events.map((e, i) => `<option value="${i}">${escHtml(e.event_name)}${e.event_date ? ' · ' + e.event_date : ''}</option>`).join('')
      : '<option value="">Nejprve nahrajte Excel</option>';

    App.showModal({
      title: '✉️ Generátor pozvánky — O2 Arena',
      size: 'lg',
      body: `
        <div class="form-group">
          <label class="form-label">Vyberte akci</label>
          <select id="inviteEventSel" class="form-control"><option value="">-- Vyberte akci --</option>${opts}</select>
        </div>
        <div class="form-row">
          <div class="form-group">
            <label class="form-label">Název akce <span class="form-hint">(editovatelný)</span></label>
            <input type="text" id="inviteEventName" class="form-control" placeholder="Název akce">
          </div>
          <div class="form-group">
            <label class="form-label">Datum akce</label>
            <input type="text" id="inviteEventDate" class="form-control" placeholder="pátek 14. března 2026, 18:00">
          </div>
        </div>
        <div class="form-row">
          <div class="form-group">
            <label class="form-label">Jméno zákazníka</label>
            <input type="text" id="inviteKontakt" class="form-control" placeholder="Ing. Jan Novák">
          </div>
          <div class="form-group">
            <label class="form-label">Firma</label>
            <input type="text" id="inviteFirma" class="form-control" placeholder="ABC s.r.o.">
          </div>
        </div>
        <div class="form-row">
          <div class="form-group">
            <label class="form-label">Počet vstupenek</label>
            <input type="number" id="inviteCount" class="form-control" value="2" min="1" max="20">
          </div>
          <div class="form-group">
            <label class="form-label">Tón</label>
            <select id="inviteTone" class="form-control">
              <option value="formalni">Formální (vykání)</option>
              <option value="neformalni">Neformální (tykání)</option>
            </select>
          </div>
        </div>
        <div class="form-group">
          <label class="form-label">Kontext pro AI <span class="form-hint">(volitelné)</span></label>
          <textarea id="inviteContext" class="form-control" rows="2" placeholder="Zákazník je fanoušek hokeje, nedávno jsme podepsali smlouvu na cloud…"></textarea>
        </div>
        <button class="btn btn-primary btn-full" id="generateInviteBtn">✨ Generovat pozvánku</button>
        <div id="inviteOutputWrap" class="hidden" style="margin-top:1rem">
          <label class="form-label">Výsledek</label>
          <textarea id="inviteTextOut" class="form-control" rows="10" readonly style="background:var(--bg);font-size:13px"></textarea>
          <div style="display:flex;gap:.5rem;margin-top:.6rem">
            <button class="btn btn-secondary" id="copyInviteBtn">📋 Kopírovat</button>
            <button class="btn btn-primary" id="mailInviteBtn">📧 Otevřít v emailu</button>
          </div>
        </div>`,
    });

    // Auto-fill on event select
    document.getElementById('inviteEventSel')?.addEventListener('change', (e) => {
      const idx = parseInt(e.target.value);
      if (!isNaN(idx) && events[idx]) {
        document.getElementById('inviteEventName').value = events[idx].event_name;
        document.getElementById('inviteEventDate').value = events[idx].event_date || '';
      }
    });

    document.getElementById('generateInviteBtn')?.addEventListener('click', async () => {
      const eventName = document.getElementById('inviteEventName')?.value.trim();
      const eventDate = document.getElementById('inviteEventDate')?.value.trim();
      const kontakt   = document.getElementById('inviteKontakt')?.value.trim();
      const firma     = document.getElementById('inviteFirma')?.value.trim();
      const count     = document.getElementById('inviteCount')?.value || '2';
      const tone      = document.getElementById('inviteTone')?.value;
      const context   = document.getElementById('inviteContext')?.value.trim();

      if (!eventName || !kontakt) { App.showToast('Vyplňte akci a zákazníka', 'warning'); return; }

      const btn = document.getElementById('generateInviteBtn');
      App.setLoading(btn, true);

      const toneStr = tone === 'neformalni' ? 'neformální styl, tykání' : 'formální styl, vykání';
      const userMsg = `Napiš pozvánku na akci.
Akce: ${eventName}
Datum: ${eventDate || 'bude upřesněno'}
Zákazník: ${kontakt}${firma ? ', ' + firma : ''}
Počet vstupenek: ${count}
Styl: ${toneStr}
${context ? 'Kontext: ' + context : ''}`;

      try {
        const text = await App.callAI(INVITE_SYSTEM, userMsg, { maxTokens: 700 });
        const ta = document.getElementById('inviteTextOut');
        if (ta) ta.value = text;
        document.getElementById('inviteOutputWrap')?.classList.remove('hidden');

        // Parse subject for mailto
        const subjectMatch = text.match(/^Předmět:\s*(.+)/m);
        const subject = subjectMatch ? subjectMatch[1].trim() : `Pozvánka: ${eventName}`;
        const body = text.replace(/^Předmět:.*\n?\n?/, '');

        document.getElementById('copyInviteBtn').onclick = () => { App.copyToClipboard(text); App.showToast('📋 Zkopírováno', 'success'); };
        document.getElementById('mailInviteBtn').onclick = () => {
          window.location.href = `mailto:?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
        };
        App.showToast('✨ Pozvánka vygenerována', 'success');
      } catch (err) {
        App.showToast('Chyba: ' + err.message, 'error');
      } finally {
        App.setLoading(btn, false);
      }
    });
  }

  /* ══════════════════════════════════════════
     SEKCE 4 — HISTORIE
  ══════════════════════════════════════════ */
  function getHistory() {
    try { return JSON.parse(localStorage.getItem('o2_history_v2') || '[]'); } catch { return []; }
  }
  function saveHistory(h) { localStorage.setItem('o2_history_v2', JSON.stringify(h)); }

  async function importToHistory(rows, fromExcel) {
    const existing = getHistory();
    const existingKeys = new Set(existing.map(h => h.dedup_key));
    const toAdd = rows.filter(r => !existingKeys.has(r.dedup_key));

    toAdd.forEach(r => {
      existing.push({
        id:         Date.now() + Math.random(),
        dedup_key:  r.dedup_key,
        event_name: r.event_name,
        event_date: r.event_date,
        kontakt:    r.kontakt,
        firma:      r.firma,
        tickets_count: r.tickets_count,
        poznamka:   '',
        from_xlsx:  fromExcel,
        created_at: new Date().toISOString(),
      });
    });

    saveHistory(existing);

    // Also sync to Supabase if available
    if (toAdd.length) {
      try {
        await App.db.upsertTickets(toAdd.map(r => ({
          customer_name: r.kontakt, company: r.firma,
          event_name: r.event_name, event_date: r.event_date,
          tickets_count: r.tickets_count, status: 'schváleno',
          am: 'Jakub Sedláček', dedup_key: r.dedup_key,
        })));
      } catch { /* localStorage already saved */ }
    }

    return toAdd.length;
  }

  function loadHistory() {
    const history = getHistory();
    const el = document.getElementById('ticketsHistoryList');
    const countEl = document.getElementById('historyCount');
    if (countEl) countEl.textContent = `${history.length} záznamů`;

    // Dashboard KPI
    const kpiEl = document.getElementById('kpiTickets');
    if (kpiEl) kpiEl.textContent = history.length;

    if (!el) return;
    if (!history.length) {
      el.innerHTML = `<div class="empty-state"><div class="empty-icon">🎟️</div><p>Žádná historie lístků.<br>Nahrajte Excel nebo přidejte ručně.</p></div>`;
      return;
    }

    // Group by customer + firma
    const grouped = {};
    history.forEach(h => {
      const key = norm(h.kontakt + '|' + h.firma);
      if (!grouped[key]) grouped[key] = { kontakt: h.kontakt, firma: h.firma, records: [], totalTix: 0 };
      grouped[key].records.push(h);
      grouped[key].totalTix += h.tickets_count;
    });

    // Sort by totalTix desc
    const sorted = Object.values(grouped).sort((a, b) => b.totalTix - a.totalTix);

    el.innerHTML = sorted.map(g => {
      const hasExcel  = g.records.some(r => r.from_xlsx);
      const hasManual = g.records.some(r => !r.from_xlsx);
      const badge = hasExcel
        ? `<span class="badge badge-info" style="font-size:10px">⚡ Excel</span>`
        : `<span class="badge badge-success" style="font-size:10px">✓ Ruční</span>`;

      const cards = g.records
        .sort((a, b) => (b.event_date || '').localeCompare(a.event_date || ''))
        .map(r => {
          const barColor = r.from_xlsx ? 'var(--primary)' : 'var(--success)';
          return `<div class="history-event-card">
            <div style="height:4px;background:${barColor};border-radius:var(--radius-sm) var(--radius-sm) 0 0"></div>
            <div class="history-event-card-body">
              <div class="history-event-date">${escHtml(r.event_date || '–')}</div>
              <div class="history-event-name">${escHtml(r.event_name)}</div>
              <div class="history-event-count">🎟️ ${r.tickets_count} lístek/lístků</div>
              ${r.poznamka ? `<div style="font-size:11px;color:var(--text-tertiary);margin-top:.2rem">${escHtml(r.poznamka)}</div>` : ''}
            </div>
          </div>`;
        }).join('');

      return `<div class="history-customer-card">
        <div class="history-customer-header">
          <div>
            <div class="history-customer-name">${escHtml(g.kontakt || '–')}</div>
            <div class="history-customer-firma">${escHtml(g.firma || '–')}</div>
          </div>
          <div style="display:flex;align-items:center;gap:.6rem">
            ${badge}
            <div class="history-total-tix">${g.totalTix}</div>
            <div style="font-size:11px;color:var(--text-tertiary);margin-top:.1rem">lístků</div>
          </div>
          <button class="btn btn-sm btn-danger" onclick="TicketsModule._deleteCustomer('${norm(g.kontakt)}','${norm(g.firma)}')" title="Smazat záznamy">🗑</button>
        </div>
        <div class="history-events-scroll">${cards}</div>
      </div>`;
    }).join('');
  }

  function _deleteCustomer(kontaktNorm, firmaNorm) {
    if (!confirm('Smazat všechny záznamy tohoto zákazníka?')) return;
    const h = getHistory().filter(r => !(norm(r.kontakt) === kontaktNorm && norm(r.firma) === firmaNorm));
    saveHistory(h);
    loadHistory();
    App.showToast('Zákazník smazán', 'info');
  }

  /* ─── Manual add ─── */
  function setupManualAddBtn() {
    // Inject "Přidat ručně" button into history tab header
    const histHeader = document.querySelector('#tab-tickets-history .card-header');
    if (histHeader && !document.getElementById('addManualTicketBtn')) {
      const btn = document.createElement('button');
      btn.id = 'addManualTicketBtn';
      btn.className = 'btn btn-sm btn-primary';
      btn.textContent = '+ Přidat ručně';
      btn.addEventListener('click', openManualAddModal);
      histHeader.appendChild(btn);
    }
  }

  function openManualAddModal() {
    const events = getUniqueEventList();
    const opts = events.map((e, i) => `<option value="${i}">${escHtml(e.event_name)}</option>`).join('');

    App.showModal({
      title: '+ Přidat lístek ručně',
      body: `
        <div class="form-group">
          <label class="form-label">Akce</label>
          ${opts ? `<select id="manualEventSel" class="form-control"><option value="">-- Vyberte nebo zadejte níže --</option>${opts}</select>` : ''}
          <input type="text" id="manualEventName" class="form-control" placeholder="Název akce" style="margin-top:.5rem">
        </div>
        <div class="form-group">
          <label class="form-label">Datum</label>
          <input type="text" id="manualDate" class="form-control" placeholder="14.3.2026">
        </div>
        <div class="form-row">
          <div class="form-group">
            <label class="form-label">Zákazník</label>
            <input type="text" id="manualKontakt" class="form-control" placeholder="Jméno">
          </div>
          <div class="form-group">
            <label class="form-label">Firma</label>
            <input type="text" id="manualFirma" class="form-control" placeholder="ABC s.r.o.">
          </div>
        </div>
        <div class="form-group">
          <label class="form-label">Počet lístků</label>
          <input type="number" id="manualCount" class="form-control" value="2" min="1">
        </div>
        <div class="form-group">
          <label class="form-label">Poznámka</label>
          <input type="text" id="manualNote" class="form-control" placeholder="Volitelná poznámka">
        </div>`,
      footer: `
        <button class="btn btn-secondary" onclick="App.closeModal()">Zrušit</button>
        <button class="btn btn-primary" onclick="TicketsModule._saveManual()">✓ Uložit</button>`,
    });

    document.getElementById('manualEventSel')?.addEventListener('change', (e) => {
      const idx = parseInt(e.target.value);
      if (!isNaN(idx) && events[idx]) {
        document.getElementById('manualEventName').value = events[idx].event_name;
        document.getElementById('manualDate').value = events[idx].event_date || '';
      }
    });
  }

  function _saveManual() {
    const eventName = document.getElementById('manualEventName')?.value.trim();
    const date      = document.getElementById('manualDate')?.value.trim();
    const kontakt   = document.getElementById('manualKontakt')?.value.trim();
    const firma     = document.getElementById('manualFirma')?.value.trim();
    const count     = parseInt(document.getElementById('manualCount')?.value) || 1;
    const note      = document.getElementById('manualNote')?.value.trim();

    if (!eventName || !kontakt) { App.showToast('Vyplňte akci a zákazníka', 'warning'); return; }

    const key = dedupKey(eventName, firma, date, count);
    const h = getHistory();
    if (h.some(r => r.dedup_key === key)) { App.showToast('Tento záznam už existuje', 'info'); App.closeModal(); return; }

    h.push({
      id: Date.now() + Math.random(), dedup_key: key,
      event_name: eventName, event_date: date,
      kontakt, firma, tickets_count: count,
      poznamka: note, from_xlsx: false,
      created_at: new Date().toISOString(),
    });
    saveHistory(h);
    App.closeModal();
    loadHistory();
    App.showToast('✓ Uloženo', 'success');
  }

  /* ══════════════════════════════════════════
     SEKCE 5 — GENERÁTOR NOMINACÍ
  ══════════════════════════════════════════ */
  const NOM_KEY = 'o2_nominations';
  function getNominations() { try { return JSON.parse(localStorage.getItem(NOM_KEY) || '[]'); } catch { return []; } }
  function saveNominations(n) { localStorage.setItem(NOM_KEY, JSON.stringify(n)); }

  function setupNominations() {
    document.getElementById('addNominationBtn')?.addEventListener('click', addNomination);
    document.getElementById('exportNomExcelBtn')?.addEventListener('click', exportNominationsExcel);
    document.getElementById('generateNomEmailBtn')?.addEventListener('click', generateNomEmail);
    document.getElementById('clearNominationsBtn')?.addEventListener('click', () => {
      if (!confirm('Vymazat všechny připravené nominace?')) return;
      saveNominations([]);
      renderNominations();
    });
    document.getElementById('copyNomEmailBtn')?.addEventListener('click', () => {
      App.copyToClipboard(document.getElementById('nomEmailText')?.value || '');
      App.showToast('Zkopírováno', 'success');
    });
    document.getElementById('mailNomEmailBtn')?.addEventListener('click', () => {
      const text = document.getElementById('nomEmailText')?.value || '';
      const subjectMatch = text.match(/^Předmět:\s*(.+)/m);
      const subject = subjectMatch ? subjectMatch[1].trim() : 'Nominace vstupenek O2 Arena';
      const body = text.replace(/^Předmět:.*\n?\n?/, '');
      window.location.href = `mailto:?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
    });
    renderNominations();
  }

  function populateNomEventSelect() {
    const sel = document.getElementById('nomEventSel');
    if (!sel) return;
    const events = getUniqueEventList();
    const current = sel.value;
    sel.innerHTML = '<option value="">-- Vyberte akci --</option>' +
      events.map((e, i) => `<option value="${i}">${escHtml(e.event_name)}${e.event_date ? ' · ' + e.event_date : ''}</option>`).join('');
    sel.value = current;
  }

  function addNomination() {
    const selIdx = parseInt(document.getElementById('nomEventSel')?.value);
    const events = getUniqueEventList();
    const event = !isNaN(selIdx) && events[selIdx] ? events[selIdx] : null;

    if (!event) { App.showToast('Vyberte akci', 'warning'); return; }
    const kontakt = document.getElementById('nomKontakt')?.value.trim();
    const firma   = document.getElementById('nomFirma')?.value.trim();
    if (!kontakt || !firma) { App.showToast('Vyplňte kontaktní osobu a firmu', 'warning'); return; }

    const nom = {
      id: Date.now() + Math.random(),
      event_name: event.event_name,
      event_date: event.event_date || '',
      op:         document.getElementById('nomOP')?.value.trim() || '',
      kontakt,
      firma,
      pozice:     document.getElementById('nomPozice')?.value.trim() || '',
      ico:        document.getElementById('nomICO')?.value.trim() || '',
      vynosy:     document.getElementById('nomVynosy')?.value.trim() || '',
      typ:        document.getElementById('nomTyp')?.value || 'Retence',
      zduvodneni: document.getElementById('nomZduvodneni')?.value.trim() || '',
      telefon:    document.getElementById('nomTelefon')?.value.trim() || '',
      count:      parseInt(document.getElementById('nomCount')?.value) || 2,
    };

    const noms = getNominations();
    noms.push(nom);
    saveNominations(noms);
    renderNominations();

    // Clear input fields (keep event selection)
    ['nomOP','nomKontakt','nomFirma','nomPozice','nomICO','nomVynosy','nomZduvodneni','nomTelefon'].forEach(id => {
      const el = document.getElementById(id);
      if (el) el.value = '';
    });
    document.getElementById('nomCount').value = '2';
    App.showToast('Nominace přidána', 'success');
  }

  function renderNominations() {
    const noms = getNominations();
    const wrap = document.getElementById('nomListWrap');
    const list = document.getElementById('nomList');
    const countEl = document.getElementById('nomListCount');
    if (!wrap || !list) return;

    if (!noms.length) {
      wrap.classList.add('hidden');
      return;
    }
    wrap.classList.remove('hidden');
    if (countEl) countEl.textContent = noms.length;

    list.innerHTML = noms.map(n => `
      <div class="nom-item">
        <div class="nom-item-count">${n.count}x</div>
        <div class="nom-item-info">
          <div class="nom-item-event">${escHtml(n.event_name)}</div>
          <div class="nom-item-detail">${escHtml(n.kontakt)} · ${escHtml(n.firma)}${n.event_date ? ' · ' + escHtml(n.event_date) : ''}</div>
        </div>
        <button class="nom-item-remove" onclick="TicketsModule._removeNom('${n.id}')" title="Odebrat">×</button>
      </div>`).join('');
  }

  function _removeNom(id) {
    saveNominations(getNominations().filter(n => String(n.id) !== String(id)));
    renderNominations();
  }

  function exportNominationsExcel() {
    const noms = getNominations();
    if (!noms.length) { App.showToast('Žádné nominace k exportu', 'warning'); return; }
    if (!window.XLSX) { App.showToast('SheetJS se nenačetlo', 'error'); return; }

    // Build rows matching the O2 nomination Excel format
    const headers = [
      'Datum a čas akce', '', 'Schváleno/Neschváleno/Náhradník', 'Název akce',
      'OP', 'KO', 'Zákazník', 'Pozice', 'IČO', 'Celkové Výnosy klienta',
      'Nadřízený žadatele / ASM', 'Žadatel / AM',
      'Akvizice / Retence / Nový prodej', 'Specifické zdůvodnění',
      'Klient telefon', 'SkyBox č./Místo č.', 'Počet vstupenek',
    ];

    const rows = [headers];
    noms.forEach(n => {
      rows.push([
        n.event_date || '',     // A: Datum a čas akce
        '',                      // B: empty
        '',                      // C: Schváleno - empty (pending)
        n.event_name,            // D: Název akce
        n.op || '',              // E: OP
        n.kontakt,               // F: KO
        n.firma,                 // G: Zákazník
        n.pozice || '',          // H: Pozice
        n.ico || '',             // I: IČO
        n.vynosy || '',          // J: Celkové Výnosy
        'Martin Kašinský',       // K: Nadřízený
        'Jakub Sedláček',        // L: Žadatel / AM
        n.typ || 'Retence',      // M: Typ
        n.zduvodneni || '',      // N: Specifické zdůvodnění
        n.telefon || '',         // O: Klient telefon
        '',                      // P: SkyBox č.
        n.count,                 // Q: Počet vstupenek
      ]);
    });

    const ws = XLSX.utils.aoa_to_sheet(rows);

    // Set column widths
    ws['!cols'] = [
      { wch: 18 }, { wch: 5 }, { wch: 12 }, { wch: 30 }, { wch: 14 },
      { wch: 18 }, { wch: 25 }, { wch: 12 }, { wch: 10 }, { wch: 12 },
      { wch: 18 }, { wch: 16 }, { wch: 12 }, { wch: 30 }, { wch: 14 },
      { wch: 12 }, { wch: 10 },
    ];

    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Nominace');
    const today = new Date().toLocaleDateString('cs-CZ').replace(/\s/g, '');
    XLSX.writeFile(wb, `Nominace_O2Arena_${today}.xlsx`);
    App.showToast('Excel stažen', 'success');
  }

  function generateNomEmail() {
    const noms = getNominations();
    if (!noms.length) { App.showToast('Přidejte nejdřív nominace', 'warning'); return; }

    const count = noms.length;
    const plural = count === 1 ? 'akci' : count <= 4 ? 'akce' : 'akcí';

    const lines = noms.map((n, i) => {
      const tix = n.count === 1 ? '1 lístek' : n.count <= 4 ? `${n.count} lístky` : `${n.count} lístků`;
      return `${i + 1}. ${n.event_name}${n.event_date ? ' (' + n.event_date + ')' : ''} — ${n.firma}, ${tix}`;
    }).join('\n');

    const text = `Předmět: Nominace vstupenek O2 Arena — ${count} ${plural}

Ahoj Marťas,
posílám nominace / žádosti o vstupenky do arény na akce:
${lines}

Prosím o jejich zadání do nominační tabulky.
V příloze posílám vyplněný Excel.
Děkuju.
K.`;

    const ta = document.getElementById('nomEmailText');
    if (ta) ta.value = text;
    document.getElementById('nomEmailOutput')?.classList.remove('hidden');
    App.showToast('Email připraven', 'success');
  }

  return { init, _deleteCustomer, _saveManual, _removeNom, _nominateFromEvent: openNominationFromEvent };
})();

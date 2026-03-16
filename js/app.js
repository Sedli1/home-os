/* ════════════════════════════════════════════════
   app.js — Core: routing, DB layer, toasts, search, AI
   ════════════════════════════════════════════════ */

const App = (() => {
  'use strict';

  /* ─── State ─── */
  let supabaseClient = null;
  let currentPage = 'dashboard';

  /* ─── Init ─── */
  function init() {
    const cfg = window.APP_CONFIG || {};
    // User info
    const name = cfg.USER_NAME || 'Jakub Sedláček';
    const initials = cfg.USER_INITIALS || 'JS';
    document.getElementById('userAvatar').textContent = initials;
    document.getElementById('userName').textContent = name;
    document.getElementById('dashboardName').textContent = name.split(' ')[0];

    // Supabase
    if (cfg.SUPABASE_URL && cfg.SUPABASE_URL !== 'YOUR_SUPABASE_URL' && window.supabase) {
      try {
        supabaseClient = window.supabase.createClient(cfg.SUPABASE_URL, cfg.SUPABASE_ANON_KEY);
        console.log('✓ Supabase connected');
      } catch (e) {
        console.warn('Supabase init failed, using localStorage:', e.message);
      }
    } else {
      console.info('ℹ Supabase not configured — using localStorage fallback');
    }

    initRouter();
    initMobileNav();
    initGlobalSearch();
    initKpiEditing();
    initGlobalTabSwitcher();

    // Boot current page from hash or default
    const hash = location.hash.replace('#', '') || 'dashboard';
    navigateTo(hash, false);
  }

  /* ─── Global Tab Switcher ─── */
  // Handles all [data-tab-group] buttons generically
  function initGlobalTabSwitcher() {
    document.addEventListener('click', (e) => {
      const btn = e.target.closest('[data-tab-group][data-target]');
      if (!btn) return;
      const group = btn.dataset.tabGroup;
      const target = btn.dataset.target;

      // Deactivate all buttons in this group
      document.querySelectorAll(`[data-tab-group="${group}"]`).forEach(b => b.classList.remove('active'));
      btn.classList.add('active');

      // Find all tab panes belonging to this group's buttons
      document.querySelectorAll(`[data-tab-group="${group}"]`).forEach(b => {
        const pane = document.getElementById(`tab-${b.dataset.target}`);
        if (pane) { pane.classList.remove('active'); pane.classList.add('hidden'); }
      });

      // Show target pane
      const targetPane = document.getElementById(`tab-${target}`);
      if (targetPane) { targetPane.classList.remove('hidden'); targetPane.classList.add('active'); }
    });
  }

  /* ─── Router ─── */
  function initRouter() {
    // Logo click → dashboard
    document.querySelectorAll('.sidebar-logo, .mobile-logo').forEach(el => {
      el.style.cursor = 'pointer';
      el.addEventListener('click', () => { navigateTo('dashboard'); closeMobileNav(); });
    });

    // Nav link clicks
    document.querySelectorAll('.nav-link[data-page]').forEach(link => {
      link.addEventListener('click', (e) => {
        e.preventDefault();
        const page = link.dataset.page;
        navigateTo(page);
        closeMobileNav();
      });
    });

    window.addEventListener('hashchange', () => {
      const page = location.hash.replace('#', '');
      if (page && page !== currentPage) navigateTo(page, false);
    });
  }

  function navigateTo(pageId, pushHistory = true) {
    const validPages = ['dashboard','email','tickets','objections','sfa','cowork'];
    if (!validPages.includes(pageId)) pageId = 'dashboard';

    // Hide all pages
    document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
    // Show target
    const target = document.getElementById(`page-${pageId}`);
    if (target) target.classList.add('active');

    // Update nav
    document.querySelectorAll('.nav-link').forEach(l => {
      l.classList.toggle('active', l.dataset.page === pageId);
    });

    if (pushHistory) history.pushState(null, '', `#${pageId}`);
    currentPage = pageId;

    // Init page modules
    const modules = {
      dashboard:  window.DashboardModule,
      email:      window.EmailModule,
      tickets:    window.TicketsModule,
      objections: window.ObjectionsModule,
      sfa:        window.SFAModule,
      cowork:     window.CoworkModule,
    };
    const mod = modules[pageId];
    if (mod && typeof mod.init === 'function') mod.init();
  }

  /* ─── Mobile Nav ─── */
  function initMobileNav() {
    const hamburger = document.getElementById('hamburgerBtn');
    const sidebar = document.getElementById('sidebar');
    const overlay = document.getElementById('navOverlay');

    hamburger.addEventListener('click', () => {
      sidebar.classList.toggle('open');
      overlay.classList.toggle('open');
      hamburger.classList.toggle('open');
    });

    overlay.addEventListener('click', closeMobileNav);
  }

  function closeMobileNav() {
    document.getElementById('sidebar').classList.remove('open');
    document.getElementById('navOverlay').classList.remove('open');
    document.getElementById('hamburgerBtn').classList.remove('open');
  }

  /* ─── KPI inline editing ─── */
  function initKpiEditing() {
    document.querySelectorAll('.kpi-edit-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        const kpi = btn.dataset.kpi;
        const valEl = document.getElementById(`kpi${kpi.charAt(0).toUpperCase() + kpi.slice(1)}`);
        const current = localStorage.getItem(`o2_kpi_${kpi}`) || '';
        const input = document.createElement('input');
        input.type = 'text';
        input.value = current;
        input.className = 'form-control';
        input.style.cssText = 'width:100%;font-size:1rem;font-weight:700;padding:.25rem .5rem;';
        valEl.replaceWith(input);
        input.focus();
        input.select();

        const save = () => {
          const newVal = input.value.trim();
          localStorage.setItem(`o2_kpi_${kpi}`, newVal);
          const span = document.createElement('div');
          span.className = 'kpi-value';
          span.id = `kpi${kpi.charAt(0).toUpperCase() + kpi.slice(1)}`;
          span.textContent = newVal || '–';
          input.replaceWith(span);
        };

        input.addEventListener('blur', save);
        input.addEventListener('keydown', (e) => {
          if (e.key === 'Enter') { e.preventDefault(); save(); }
          if (e.key === 'Escape') { input.replaceWith(valEl); }
        });
      });
    });

    // Load saved KPIs
    ['opportunities'].forEach(kpi => {
      const el = document.getElementById(`kpi${kpi.charAt(0).toUpperCase() + kpi.slice(1)}`);
      const saved = localStorage.getItem(`o2_kpi_${kpi}`);
      if (el && saved) el.textContent = saved;
    });
  }

  /* ─── AI Caller ─── */
  async function callAI(systemPrompt, userMessage, opts = {}) {
    const { maxTokens = 2048, expectJSON = false } = opts;

    const resp = await fetch('/api/ai', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ systemPrompt, userMessage, maxTokens }),
    });

    if (!resp.ok) {
      const err = await resp.json().catch(() => ({}));
      throw new Error(err.error || `Server error ${resp.status}`);
    }

    const data = await resp.json();
    const text = data.content || '';

    if (!expectJSON) return text;

    // Strip markdown code fences if present
    const cleaned = text
      .replace(/^```(?:json)?\s*/i, '')
      .replace(/\s*```\s*$/, '')
      .trim();

    // Try direct parse first, then extract first JSON array or object
    try { return JSON.parse(cleaned); } catch (_) { /* fall through */ }
    const arrMatch = cleaned.match(/\[[\s\S]*\]/);
    const objMatch = cleaned.match(/\{[\s\S]*\}/);
    const jsonStr = arrMatch?.[0] ?? objMatch?.[0];
    if (!jsonStr) throw new Error('Neplatná JSON odpověď od AI');
    return JSON.parse(jsonStr);
  }

  /* ─── Button loading helper ─── */
  function setLoading(btn, loading) {
    if (loading) {
      btn.disabled = true;
      btn._origText = btn.innerHTML;
      btn.innerHTML = '<span class="spinner"></span> Generuji...';
    } else {
      btn.disabled = false;
      btn.innerHTML = btn._origText || btn.innerHTML;
    }
  }

  /* ─── Toast ─── */
  function showToast(message, type = 'success', duration = 3200) {
    const icons = { success: '✓', error: '✕', info: 'i', warning: '!' };
    const container = document.getElementById('toastContainer');
    const toast = document.createElement('div');
    toast.className = `toast toast-${type}`;
    toast.innerHTML = `<div class="toast-icon">${icons[type] || 'i'}</div><div class="toast-message">${message}</div>`;
    container.appendChild(toast);
    requestAnimationFrame(() => {
      requestAnimationFrame(() => toast.classList.add('show'));
    });
    setTimeout(() => {
      toast.classList.remove('show');
      setTimeout(() => toast.remove(), 350);
    }, duration);
  }

  /* ─── Modal ─── */
  function showModal({ title, body, footer = '', size = '' }) {
    const c = document.getElementById('modalContainer');
    c.innerHTML = `
      <div class="modal-overlay" id="modalOverlay">
        <div class="modal" style="${size === 'lg' ? 'max-width:760px' : ''}">
          <div class="modal-header">
            <div class="modal-title">${title}</div>
            <button class="modal-close" onclick="App.closeModal()">×</button>
          </div>
          <div class="modal-body">${body}</div>
          ${footer ? `<div class="modal-footer">${footer}</div>` : ''}
        </div>
      </div>`;
    document.getElementById('modalOverlay').addEventListener('click', (e) => {
      if (e.target.id === 'modalOverlay') closeModal();
    });
  }

  function closeModal() {
    document.getElementById('modalContainer').innerHTML = '';
  }

  /* ─── Global Search ─── */
  function initGlobalSearch() {
    const overlay = document.getElementById('searchOverlay');
    const input = document.getElementById('globalSearchInput');
    const results = document.getElementById('searchResults');

    // Keyboard shortcut
    document.addEventListener('keydown', (e) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
        e.preventDefault();
        openSearch();
      }
      if (e.key === 'Escape') {
        closeSearch();
        closeModal();
      }
    });

    document.getElementById('sidebarSearchBtn').addEventListener('click', openSearch);
    document.getElementById('mobileSearchBtn').addEventListener('click', openSearch);
    document.getElementById('searchBackdrop').addEventListener('click', closeSearch);

    input.addEventListener('input', debounce(() => performSearch(input.value.trim(), results), 220));
  }

  function openSearch() {
    const overlay = document.getElementById('searchOverlay');
    overlay.classList.remove('hidden');
    setTimeout(() => document.getElementById('globalSearchInput').focus(), 50);
  }

  function closeSearch() {
    document.getElementById('searchOverlay').classList.add('hidden');
    document.getElementById('globalSearchInput').value = '';
    document.getElementById('searchResults').innerHTML = '<div class="search-hint">Začněte psát pro vyhledávání...</div>';
  }

  async function performSearch(query, container) {
    if (!query || query.length < 2) {
      container.innerHTML = '<div class="search-hint">Začněte psát pro vyhledávání...</div>';
      return;
    }
    const q = query.toLowerCase();

    try {
      const tickets = await db.getTicketHistory();
      const ticketResults = tickets.filter(t =>
        (t.customer_name || '').toLowerCase().includes(q) ||
        (t.company || '').toLowerCase().includes(q) ||
        (t.event_name || '').toLowerCase().includes(q)
      ).slice(0, 8);

      if (ticketResults.length === 0) {
        container.innerHTML = '<div class="search-hint">Žádné výsledky pro „' + escHtml(query) + '"</div>';
        return;
      }

      container.innerHTML = ticketResults.map(t => `
        <div class="search-result-item" onclick="App.navigateTo('tickets');App.closeSearch()">
          <div class="search-result-icon type-ticket">🎟️</div>
          <div class="search-result-body">
            <div class="search-result-title">${escHtml(t.customer_name)} — ${escHtml(t.company)}</div>
            <div class="search-result-sub">${escHtml(t.event_name)} · ${escHtml(t.event_date || '')}</div>
          </div>
          <span class="search-result-tag">Lístek</span>
        </div>`).join('');
    } catch {
      container.innerHTML = '<div class="search-hint">Chyba při vyhledávání</div>';
    }
  }

  /* ─── DB Abstraction Layer ─── */
  const db = {
    /* --- Ticket History --- */
    async getTicketHistory() {
      if (supabaseClient) {
        const { data, error } = await supabaseClient
          .from('ticket_history')
          .select('*')
          .order('created_at', { ascending: false });
        if (error) throw error;
        return data || [];
      }
      return JSON.parse(localStorage.getItem('o2_ticket_history') || '[]');
    },

    async upsertTickets(tickets) {
      // tickets: array of {customer_name, company, event_name, event_date, tickets_count, status, am, dedup_key}
      if (supabaseClient) {
        const { error } = await supabaseClient
          .from('ticket_history')
          .upsert(tickets, { onConflict: 'dedup_key', ignoreDuplicates: true });
        if (error) throw error;
        return;
      }
      const existing = JSON.parse(localStorage.getItem('o2_ticket_history') || '[]');
      const existingKeys = new Set(existing.map(t => t.dedup_key));
      const newOnes = tickets.filter(t => !existingKeys.has(t.dedup_key));
      const merged = [...newOnes, ...existing];
      localStorage.setItem('o2_ticket_history', JSON.stringify(merged));
    },

    /* --- Checklist --- */
    async getChecklistState() {
      if (supabaseClient) {
        const { data, error } = await supabaseClient
          .from('checklist_state')
          .select('*');
        if (error) throw error;
        const map = {};
        (data || []).forEach(r => { map[r.item_key] = { checked: r.checked, notes: r.notes || '' }; });
        return map;
      }
      return JSON.parse(localStorage.getItem('o2_checklist') || '{}');
    },

    async saveChecklistItem(key, checked, notes) {
      if (supabaseClient) {
        const { error } = await supabaseClient
          .from('checklist_state')
          .upsert({ item_key: key, checked, notes, updated_at: new Date().toISOString() }, { onConflict: 'item_key' });
        if (error) throw error;
        return;
      }
      const state = JSON.parse(localStorage.getItem('o2_checklist') || '{}');
      state[key] = { checked, notes };
      localStorage.setItem('o2_checklist', JSON.stringify(state));
    },

    async clearChecklist() {
      if (supabaseClient) {
        const { error } = await supabaseClient.from('checklist_state').delete().neq('id', '00000000-0000-0000-0000-000000000000');
        if (error) throw error;
        return;
      }
      localStorage.removeItem('o2_checklist');
    },

    /* --- Focus List --- */
    async getFocusItems() {
      if (supabaseClient) {
        try {
          const { data, error } = await supabaseClient
            .from('focus_items')
            .select('*')
            .order('sort_order', { ascending: true });
          if (error) throw error;
          return (data || []).map(r => ({
            id:        r.item_id,
            text:      r.text,
            priority:  r.priority || 'medium',
            category:  r.category || 'other',
            dueDate:   r.due_date || '',
            done:      r.done || false,
            doneAt:    r.done_at ? new Date(r.done_at).getTime() : null,
            createdAt: r.created_at ? new Date(r.created_at).getTime() : Date.now(),
          }));
        } catch {
          console.warn('Focus list: Supabase read failed, using localStorage');
        }
      }
      return JSON.parse(localStorage.getItem('o2_focus_v2') || '[]');
    },

    async saveFocusItems(items) {
      // Always keep localStorage in sync (fast local reads, offline fallback)
      localStorage.setItem('o2_focus_v2', JSON.stringify(items));
      if (supabaseClient) {
        try {
          const rows = items.map((i, idx) => ({
            item_id:    String(i.id),
            text:       i.text,
            priority:   i.priority || 'medium',
            category:   i.category || 'other',
            due_date:   i.dueDate || null,
            done:       i.done || false,
            done_at:    i.doneAt ? new Date(i.doneAt).toISOString() : null,
            sort_order: idx,
            created_at: i.createdAt ? new Date(i.createdAt).toISOString() : new Date().toISOString(),
          }));
          if (rows.length > 0) {
            const { error } = await supabaseClient
              .from('focus_items')
              .upsert(rows, { onConflict: 'item_id' });
            if (error) throw error;
            // Delete rows that were removed from the list
            const ids = rows.map(r => r.item_id);
            await supabaseClient.from('focus_items').delete()
              .not('item_id', 'in', `(${ids.join(',')})`);
          } else {
            // All items deleted — clear table
            await supabaseClient.from('focus_items').delete().neq('item_id', '');
          }
        } catch {
          console.warn('Focus list: Supabase write failed, saved to localStorage only');
        }
      }
    },
  };

  /* ─── Utilities ─── */
  function escHtml(str) {
    return String(str || '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
  }

  function debounce(fn, ms) {
    let t;
    return (...args) => { clearTimeout(t); t = setTimeout(() => fn(...args), ms); };
  }

  function copyToClipboard(text) {
    navigator.clipboard.writeText(text).then(() => {
      showToast('Zkopírováno do schránky', 'success');
    }).catch(() => {
      showToast('Kopírování selhalo', 'error');
    });
  }

  function formatDate(dateStr) {
    if (!dateStr) return '–';
    try {
      return new Date(dateStr).toLocaleDateString('cs-CZ', { day: 'numeric', month: 'long', year: 'numeric' });
    } catch { return dateStr; }
  }

  function todayDateValue() {
    return new Date().toISOString().split('T')[0];
  }

  /* ─── Public API ─── */
  return {
    init,
    navigateTo,
    closeModal,
    closeSearch,
    showModal,
    showToast,
    callAI,
    setLoading,
    copyToClipboard,
    escHtml,
    formatDate,
    db,
  };
})();

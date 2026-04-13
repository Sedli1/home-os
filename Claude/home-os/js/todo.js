/* ═══════════════════════════════════════════════
   Home OS — Úkolník + Denní pracovní Check-in
   ═══════════════════════════════════════════════ */

const Todo = (() => {
  let members   = [];
  let _bound    = false;
  let showDone  = false;
  let _activeTab = 'ukoly';

  const PRIORITIES = {
    vysoká:  { label: 'Vysoká',  color: '#ef4444', emoji: '🔴' },
    střední: { label: 'Střední', color: '#f59e0b', emoji: '🟡' },
    nízká:   { label: 'Nízká',   color: '#10b981', emoji: '🟢' },
  };

  // ═══════════════════════════════════════════════
  //  LOAD
  // ═══════════════════════════════════════════════

  async function load() {
    const { data } = await db.from('family_members').select('id,name,color').order('name');
    members = data ?? [];

    if (!_bound) {
      document.getElementById('addTodoBtn')?.addEventListener('click', openAdd);
      document.getElementById('todoShowDoneBtn')?.addEventListener('click', toggleShowDone);

      document.querySelectorAll('#page-todo .tab-btn').forEach(btn => {
        btn.addEventListener('click', () => {
          _setTab(btn.dataset.tab);
        });
      });

      _bound = true;
    }

    _setTab(_activeTab);
  }

  function _setTab(tab) {
    _activeTab = tab;
    document.querySelectorAll('#page-todo .tab-btn').forEach(b => b.classList.toggle('active', b.dataset.tab === tab));
    document.querySelectorAll('#page-todo .tab-panel').forEach(p => p.classList.toggle('active', p.id === `todo-tab-${tab}`));

    const addBtn  = document.getElementById('addTodoBtn');
    const doneBtn = document.getElementById('todoShowDoneBtn');
    if (addBtn)  addBtn.style.display  = tab === 'ukoly' ? '' : 'none';
    if (doneBtn) doneBtn.style.display = tab === 'ukoly' ? '' : 'none';

    if (tab === 'ukoly')      loadTodos();
    if (tab === 'checkin')    { loadCheckin(); setTimeout(() => _loadDbTodayTasks(), 100); }
    if (tab === 'delegovano') loadDelegated();
  }

  // ═══════════════════════════════════════════════
  //  TODO LIST (původní funkce)
  // ═══════════════════════════════════════════════

  async function loadTodos() {
    const el = document.getElementById('todo-list');
    if (!el) return;
    el.innerHTML = '<div class="loading"><div class="spinner"></div> Načítám…</div>';

    let q = db.from('todos').select('*, family_members(name,color)')
      .order('done').order('priority_order')
      .order('due_date', { nullsFirst: false })
      .order('created_at', { ascending: false });
    if (!showDone) q = q.eq('done', false);

    const { data, error } = await q.limit(100);
    if (error) { el.innerHTML = `<div class="empty-state"><div class="empty-text">Chyba: ${App.esc(error.message)}</div></div>`; return; }

    const btn = document.getElementById('todoShowDoneBtn');
    if (btn) btn.textContent = showDone ? 'Skrýt hotové' : 'Zobrazit hotové';

    if (!data?.length) {
      el.innerHTML = `<div class="empty-state">
        <div class="empty-icon">✅</div>
        <div class="empty-title">${showDone ? 'Žádné úkoly' : 'Vše hotovo!'}</div>
        <div class="empty-text">Přidejte první úkol tlačítkem výše.</div>
      </div>`;
      return;
    }

    const active = data.filter(t => !t.done);
    const done   = data.filter(t => t.done);
    const today  = new Date().toISOString().split('T')[0];

    let html = '';
    if (active.length) {
      const overdue    = active.filter(t => t.due_date && t.due_date < today);
      const todayTasks = active.filter(t => t.due_date === today);
      const upcoming   = active.filter(t => !t.due_date || t.due_date > today);
      if (overdue.length)    html += renderGroup('🚨 Po termínu', overdue);
      if (todayTasks.length) html += renderGroup('📅 Dnes', todayTasks);
      if (upcoming.length)   html += renderGroup('📋 Úkoly', upcoming);
    }
    if (done.length && showDone) html += renderGroup('✅ Hotové', done, true);

    el.innerHTML = html || `<div class="empty-state"><div class="empty-icon">✅</div><div class="empty-title">Vše hotovo!</div></div>`;
  }

  function renderGroup(title, items, dimmed = false) {
    return `<div style="margin-bottom:1.25rem">
      <div style="font-size:.75rem;font-weight:700;text-transform:uppercase;letter-spacing:.07em;color:var(--text-muted);margin-bottom:.5rem">${title}</div>
      <div style="display:flex;flex-direction:column;gap:.375rem">${items.map(renderItem).join('')}</div>
    </div>`;
  }

  function renderItem(t) {
    const pri    = PRIORITIES[t.priority] ?? PRIORITIES.střední;
    const m      = t.family_members;
    const today  = new Date().toISOString().split('T')[0];
    const overdue = t.due_date && t.due_date < today && !t.done;
    return `<div class="todo-item ${t.done ? 'todo-done' : ''}" data-id="${t.id}">
      <button class="todo-check ${t.done ? 'checked' : ''}" onclick="Todo.toggle('${t.id}',${t.done})" title="Označit jako hotové"></button>
      <div class="todo-body">
        <div class="todo-title">${App.esc(t.title)}</div>
        <div class="todo-meta">
          ${m ? `<span style="font-size:.72rem;font-weight:600;padding:.1rem .35rem;border-radius:99px;background:${m.color??'#6366f1'}18;color:${m.color??'#6366f1'}">${App.esc(m.name)}</span>` : ''}
          ${t.due_date ? `<span style="font-size:.75rem;color:${overdue?'var(--danger)':'var(--text-muted)'}">${overdue?'⚠️ ':''} ${App.formatDate(t.due_date)}</span>` : ''}
          <span style="font-size:.72rem">${pri.emoji}</span>
        </div>
        ${t.notes ? `<div style="font-size:.78rem;color:var(--text-muted);margin-top:.15rem">${App.esc(t.notes)}</div>` : ''}
      </div>
      <div style="display:flex;gap:.25rem;flex-shrink:0">
        <button class="btn btn-icon btn-ghost btn-sm" onclick="Todo.openEdit('${t.id}')">✏️</button>
        <button class="btn btn-icon btn-ghost btn-sm" onclick="Todo.delete('${t.id}')">🗑️</button>
      </div>
    </div>`;
  }

  function toggleShowDone() { showDone = !showDone; loadTodos(); }

  function modalBody(t = {}) {
    const memOptions = members.map(m =>
      `<option value="${m.id}" ${t.assigned_to === m.id ? 'selected' : ''}>${App.esc(m.name)}</option>`
    ).join('');
    return `
      <div class="form-group">
        <label class="form-label">Úkol *</label>
        <input id="todo-title" class="form-control" placeholder="např. Zavolat pojišťovně" value="${App.esc(t.title ?? '')}">
      </div>
      <div class="form-row">
        <div class="form-group">
          <label class="form-label">Přiřadit</label>
          <select id="todo-member" class="form-control">
            <option value="">— nikdo —</option>${memOptions}
          </select>
        </div>
        <div class="form-group">
          <label class="form-label">Priorita</label>
          <select id="todo-priority" class="form-control">
            <option value="vysoká" ${t.priority==='vysoká'?'selected':''}>🔴 Vysoká</option>
            <option value="střední" ${!t.priority||t.priority==='střední'?'selected':''}>🟡 Střední</option>
            <option value="nízká" ${t.priority==='nízká'?'selected':''}>🟢 Nízká</option>
          </select>
        </div>
      </div>
      <div class="form-group">
        <label class="form-label">Termín</label>
        <input id="todo-due" type="date" class="form-control" value="${t.due_date ?? ''}">
      </div>
      <div class="form-group">
        <label class="form-label">Poznámka</label>
        <textarea id="todo-notes" class="form-control" rows="2">${App.esc(t.notes ?? '')}</textarea>
      </div>`;
  }

  function collectData() {
    return {
      title:       document.getElementById('todo-title')?.value.trim(),
      assigned_to: document.getElementById('todo-member')?.value || null,
      priority:    document.getElementById('todo-priority')?.value || 'střední',
      due_date:    document.getElementById('todo-due')?.value || null,
      notes:       document.getElementById('todo-notes')?.value.trim() || null,
    };
  }

  function openAdd() {
    App.openModal('📋 Nový úkol', modalBody(), {
      saveLabel: 'Přidat',
      onSave: async () => {
        const d = collectData();
        if (!d.title) { App.toast('Zadejte úkol.', 'error'); return; }
        const { error } = await db.from('todos').insert({ ...d, done: false, priority_order: d.priority === 'vysoká' ? 1 : d.priority === 'nízká' ? 3 : 2 });
        if (error) { App.toast('Chyba: ' + error.message, 'error'); return; }
        App.toast('Přidáno ✓', 'success');
        App.closeModal();
        loadTodos();
      }
    });
  }

  async function openEdit(id) {
    const { data: t } = await db.from('todos').select('*').eq('id', id).single();
    if (!t) return;
    App.openModal('✏️ Upravit úkol', modalBody(t), {
      saveLabel: 'Uložit',
      onSave: async () => {
        const d = collectData();
        if (!d.title) { App.toast('Zadejte úkol.', 'error'); return; }
        const { error } = await db.from('todos').update({ ...d, priority_order: d.priority === 'vysoká' ? 1 : d.priority === 'nízká' ? 3 : 2 }).eq('id', id);
        if (error) { App.toast('Chyba: ' + error.message, 'error'); return; }
        App.toast('Uloženo ✓', 'success');
        App.closeModal();
        loadTodos();
      }
    });
  }

  async function toggle(id, isDone) {
    await db.from('todos').update({ done: !isDone }).eq('id', id);
    loadTodos();
  }

  async function deleteTodo(id) {
    if (!confirm('Smazat úkol?')) return;
    await db.from('todos').delete().eq('id', id);
    App.toast('Smazáno.', '');
    loadTodos();
  }

  // ═══════════════════════════════════════════════
  //  MŮJ DEN v2.0 — plynulý 3-fázový tok
  // ═══════════════════════════════════════════════

  function _getJournal() {
    try { return JSON.parse(localStorage.getItem('hpos_work_journal') ?? '{}'); }
    catch { return {}; }
  }
  function _saveJournal(j) { localStorage.setItem('hpos_work_journal', JSON.stringify(j)); }
  function _today() { return new Date().toISOString().split('T')[0]; }
  function _yesterday() { const d = new Date(); d.setDate(d.getDate()-1); return d.toISOString().split('T')[0]; }
  function _fmtDate(ds) { return new Date(ds+'T00:00:00').toLocaleDateString('cs-CZ',{weekday:'long',day:'numeric',month:'long'}); }

  function _categorize(text) {
    const t = text.toLowerCase();
    if (/klient|obchod|prodej|nabídka|deal|zákazník|cenov|poptávk|kontrakt|smlouv|faktur|platb/.test(t)) return 'obchod';
    if (/zavolat|call|schůzk|meeting|email|zpráva|odpověd|porada|prezentac/.test(t)) return 'komunikace';
    if (/projekt|vývoj|feature|deploy|implementace|design|kód|bug|oprav|dokončit|report/.test(t)) return 'projekt';
    if (/admin|výkaz|papír|daň|účetnictví|banka|pojišt|formulář/.test(t)) return 'admin';
    return 'ostatní';
  }

  const _CAT = {
    obchod:     { emoji: '💼', color: '#10b981', label: 'Obchod' },
    komunikace: { emoji: '📞', color: '#3b82f6', label: 'Komunikace' },
    projekt:    { emoji: '🛠️', color: '#8b5cf6', label: 'Projekt' },
    admin:      { emoji: '📄', color: '#f59e0b', label: 'Admin' },
    ostatní:    { emoji: '📌', color: '#94a3b8', label: 'Ostatní' },
  };

  const _PIPELINE = [
    { key: 'nabidka',  label: 'Nabídka k odeslání', emoji: '📤', color: '#f59e0b' },
    { key: 'cekam',    label: 'Čekám na odpověď',   emoji: '⏳', color: '#3b82f6' },
    { key: 'jednani',  label: 'Jednání',             emoji: '🤝', color: '#8b5cf6' },
    { key: 'uzavreno', label: 'Uzavřeno',            emoji: '✅', color: '#10b981' },
    { key: 'ztraceno', label: 'Ztraceno',            emoji: '❌', color: '#ef4444' },
  ];

  const _MOODS = ['😫','😕','😐','🙂','🔥'];

  // ── Streak ────────────────────────────────────
  function _calcStreak(journal) {
    let streak = 0;
    const d = new Date(_today()+'T00:00:00');
    d.setDate(d.getDate()-1);
    for (let i=0;i<365;i++) { const k=d.toISOString().split('T')[0]; if(!journal[k]?.evening_data) break; streak++; d.setDate(d.getDate()-1); }
    if (journal[_today()]?.evening_data) streak++;
    return streak;
  }

  function _rollBadge(t) {
    if (!t.roll_count || t.roll_count<1) return '';
    const c = t.roll_count>=5?'#ef4444':t.roll_count>=3?'#f59e0b':'#8b5cf6';
    return `<span style="font-size:.68rem;font-weight:700;padding:.1rem .35rem;border-radius:4px;background:${c}18;color:${c};white-space:nowrap">🔄 ${t.roll_count+1}. den${t.roll_count>=3?' ⚠️':''}</span>`;
  }

  // ── Pipeline badge (inline) ────────────────────
  function _pipelineBadge(t) {
    if (!t.pipeline_stage) return '';
    const p = _PIPELINE.find(x => x.key === t.pipeline_stage);
    if (!p) return '';
    return `<span style="display:inline-flex;align-items:center;gap:.2rem;font-size:.7rem;font-weight:600;padding:.1rem .4rem;border-radius:12px;background:${p.color}18;color:${p.color};border:1px solid ${p.color}35;white-space:nowrap;margin-top:.1rem;cursor:pointer">${p.emoji} ${p.label}</span>`;
  }

  // ═══════════════════════════════════════════════
  //  JOURNAL v2: { "YYYY-MM-DD": { tasks[], done[], evening:{note,mood}, tomorrow_tasks[] } }
  //  task = { text, time?, priority:'red'|'yellow'|'green', category, rolled, from_chain, prev_task?, roll_count,
  //           delegated_to?, delegated_due?, delegated_note?, delegated_date?, delegated_done?,
  //           pipeline_stage?, from_db? }
  // ═══════════════════════════════════════════════

  function _migrateDay(day) {
    // v1 format had day.morning.tasks, day.evening.done — convert to flat v2
    if (day.morning && !day.tasks) {
      day.tasks = day.morning.tasks ?? [];
      day.done  = day.evening?.done ?? [];
      if (day.evening) {
        day.evening_data = { note: day.evening.note ?? '', mood: null };
      }
      delete day.morning;
      delete day.evening;
    }
    return day;
  }

  // ── Render orchestrator v2 ────────────────────
  function loadCheckin() {
    const el = document.getElementById('todo-tab-checkin');
    if (!el) return;

    const j  = _getJournal();
    const dk = _today();
    if (!j[dk]) j[dk] = {};
    _migrateDay(j[dk]);
    const day  = j[dk];
    const hour = new Date().getHours();

    let html = '';

    // Auto-seed carry-over tasks from yesterday (once per day via seeded flag)
    if (!day.seeded) _seedFromYesterday(j, dk);

    const tasks     = day.tasks ?? [];
    const doneMask  = day.done ?? [];
    const hasTasks  = tasks.length > 0;
    const allDone   = hasTasks && doneMask.length >= tasks.length;
    const isEvening = hour >= 17 || allDone;
    const closed    = !!day.evening_data;

    // Header
    const streak = _calcStreak(j);
    html += `<div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:.75rem">
      <div>
        <div style="font-size:1.1rem;font-weight:700">Můj den</div>
        <div style="font-size:.8rem;color:var(--text-muted)">${_fmtDate(dk)}</div>
      </div>
      ${streak>=2?`<div style="display:flex;align-items:center;gap:.35rem;background:#10b98112;padding:.3rem .7rem;border-radius:99px"><span>🔥</span><span style="font-weight:700;color:#10b981;font-size:.85rem">${streak} dní</span></div>`:''}
    </div>`;

    // Progress bar (if has tasks)
    if (hasTasks) {
      const pct = Math.round(doneMask.length / tasks.length * 100);
      const barC = pct>=80?'#10b981':pct>=50?'#f59e0b':'var(--primary,#6366f1)';
      html += `<div style="margin-bottom:.875rem">
        <div style="display:flex;justify-content:space-between;align-items:baseline;margin-bottom:.25rem">
          <span style="font-size:.78rem;font-weight:600;color:var(--text-muted)">${doneMask.length}/${tasks.length} hotovo</span>
          <span style="font-size:.78rem;font-weight:700;color:${barC}">${pct}%</span>
        </div>
        <div style="height:6px;border-radius:99px;background:var(--surface2);overflow:hidden">
          <div style="height:100%;width:${pct}%;background:${barC};border-radius:99px;transition:width .3s"></div>
        </div>
      </div>`;
    }

    // Inline add input (always visible)
    html += `<div style="display:flex;gap:.5rem;margin-bottom:.75rem">
      <input id="mujden-input" class="form-control" placeholder="Přidej úkol a stiskni Enter…" style="flex:1;font-size:.875rem"
        onkeydown="if(event.key==='Enter'){Todo.addTask();event.preventDefault()}">
      <button class="btn btn-sm btn-primary" onclick="Todo.addTask()" style="white-space:nowrap">+ Přidat</button>
    </div>`;

    // Task cards
    html += _renderTaskCards(tasks, doneMask, dk, closed);

    // DB todos with today's deadline
    html += _renderDbTodayTasks();

    // Evening reflection (always available when tasks exist and day is open)
    if (hasTasks && !closed) {
      html += _eveningReflection(day);
    } else if (closed) {
      html += _closedDaySummary(day);
    }

    // Upcoming days
    html += _upcomingSection(j);

    // History
    html += _historySection(j);

    el.innerHTML = html;
    // Focus input
    setTimeout(() => document.getElementById('mujden-input')?.focus(), 50);
  }

  // ── Seed carry-over z včerejška ────────────────
  function _seedFromYesterday(j, dk) {
    const yKey = _yesterday();
    const yday = j[yKey];
    if (!yday) return;
    _migrateDay(yday);
    if (!j[dk].tasks) j[dk].tasks = [];
    if (!j[dk].done)  j[dk].done  = [];
    j[dk].seeded = true;

    // Prefer explicitly built tomorrow_tasks (set by closeDay).
    // Fall back to direct seeding only for days that predate closeDay logic.
    if (yday.tomorrow_tasks?.length) {
      yday.tomorrow_tasks.forEach(t => {
        j[dk].tasks.push({ ...t, from_chain: false });
      });
    } else if (yday.tasks?.length) {
      const yDone = yday.done ?? [];
      yday.tasks.forEach((t, i) => {
        if (!yDone.includes(i) && !t.delegated_to) {
          j[dk].tasks.push({ ...t, rolled: true, from_chain: false, roll_count: (t.roll_count??0)+1 });
        }
      });
    }
    _saveJournal(j);
  }

  // ── Task card rendering ───────────────────────
  function _renderTaskCards(tasks, doneMask, dk, closed) {
    if (!tasks.length) return `<div style="text-align:center;padding:2rem 1rem;color:var(--text-muted)">
      <div style="font-size:2rem;margin-bottom:.5rem">☀️</div>
      <div style="font-size:.9rem">Zadej svůj první úkol dne</div>
    </div>`;

    return tasks.map((t, i) => {
      const isDone = doneMask.includes(i);
      const cat = _CAT[t.category] ?? _CAT.ostatní;
      const priColors = { red:'#ef4444', yellow:'#f59e0b', green:'#10b981' };
      const priColor = priColors[t.priority] ?? priColors.yellow;
      const highRoll = (t.roll_count??0) >= 3;
      const hasDel = t.delegated_to && !t.delegated_done;

      return `<div style="display:flex;align-items:center;gap:.5rem;padding:.5rem .625rem;border-radius:10px;background:${isDone?'var(--surface2)':highRoll?'#ef444408':t.from_db?'var(--surface2)':'var(--surface)'};margin-bottom:.375rem;border:1px solid ${highRoll?'#ef444425':hasDel?'#f59e0b30':'var(--border)'};opacity:${isDone?'.6':'1'};transition:all .2s"
        ${isDone?'':''}>
        <button onclick="Todo.toggleTask(${i})" style="width:22px;height:22px;border-radius:6px;border:2px solid ${isDone?'#10b981':priColor};background:${isDone?'#10b981':'transparent'};cursor:pointer;flex-shrink:0;display:flex;align-items:center;justify-content:center;color:#fff;font-size:.7rem;transition:all .15s">${isDone?'✓':''}</button>
        <div style="flex:1;min-width:0${closed?'':';cursor:pointer'}" ${closed?'':` onclick="Todo.openTaskMenu(${i})"`}>
          <div style="display:flex;align-items:center;gap:.35rem;flex-wrap:wrap">
            <span style="font-size:.875rem;font-weight:${isDone?'400':'500'};${isDone?'text-decoration:line-through;color:var(--text-muted)':''}">${App.esc(t.text)}</span>
            ${_rollBadge(t)}
            ${_pipelineBadge(t)}
            ${t.from_db?'<span style="font-size:.65rem;padding:.1rem .3rem;border-radius:4px;background:var(--surface2);color:var(--text-muted)">z Úkolníku</span>':''}
          </div>
          <div style="display:flex;align-items:center;gap:.4rem;margin-top:.15rem;flex-wrap:wrap">
            <span style="font-size:.7rem;color:${cat.color}">${cat.emoji} ${cat.label}</span>
            ${t.time?`<span style="font-size:.7rem;color:var(--text-muted)">🕐 ${App.esc(t.time)}</span>`:''}
            ${hasDel?`<span style="font-size:.7rem;color:#f59e0b;font-weight:600">👤 ${App.esc(t.delegated_to)}</span>`:''}
          </div>
        </div>
        ${closed?'':`<div style="display:flex;gap:.15rem;flex-shrink:0">
          <button onclick="Todo.cyclePriority(${i})" title="Priorita" style="padding:.15rem .3rem;font-size:.7rem;border:none;background:none;cursor:pointer">
            <span style="display:inline-block;width:10px;height:10px;border-radius:50%;background:${priColor}"></span>
          </button>
          <button onclick="Todo.openTaskMenu(${i})" title="Více" style="padding:.15rem .3rem;font-size:.8rem;border:none;background:none;cursor:pointer;color:var(--text-muted)">⋯</button>
        </div>`}
      </div>`;
    }).join('');
  }

  // ── DB todos s dnešním deadline ────────────────
  function _renderDbTodayTasks() {
    // Toto se vyplní po async načtení v loadCheckin
    return '<div id="mujden-db-tasks"></div>';
  }

  async function _loadDbTodayTasks() {
    const el = document.getElementById('mujden-db-tasks');
    if (!el) return;
    const today = _today();
    const { data } = await db.from('todos').select('id,title,priority,due_date').eq('done',false).eq('due_date',today).limit(20);
    if (!data?.length) return;
    const j = _getJournal(); const dk = _today();
    const existing = (j[dk]?.tasks??[]).map(t=>t.text.toLowerCase());
    const fresh = data.filter(t => !existing.includes(t.title.toLowerCase()));
    if (!fresh.length) return;
    el.innerHTML = `<div style="margin-top:.25rem;margin-bottom:.75rem">
      <div style="font-size:.72rem;font-weight:600;color:var(--text-muted);text-transform:uppercase;letter-spacing:.05em;margin-bottom:.35rem">📋 Dnešní deadline z Úkolníku</div>
      ${fresh.map(t => `<div style="display:flex;align-items:center;gap:.5rem;padding:.375rem .5rem;border-radius:8px;background:var(--surface2);margin-bottom:.25rem;border:1px dashed var(--border)">
        <span style="flex:1;font-size:.85rem;color:var(--text-muted)">${App.esc(t.title)}</span>
        <button onclick="Todo.importDbTask('${t.id}')" class="btn btn-sm btn-outline" style="font-size:.72rem;padding:.15rem .4rem">+ Přidat do dne</button>
      </div>`).join('')}
    </div>`;
  }

  async function importDbTask(dbId) {
    const { data: t } = await db.from('todos').select('title,priority').eq('id',dbId).single();
    if (!t) return;
    const j = _getJournal(); const dk = _today();
    if (!j[dk]) j[dk] = {};
    if (!j[dk].tasks) j[dk].tasks = [];
    j[dk].tasks.push({ text: t.title, priority: t.priority==='vysoká'?'red':t.priority==='nízká'?'green':'yellow', category: _categorize(t.title), rolled:false, from_chain:false, roll_count:0, from_db:true });
    if (!j[dk].done) j[dk].done = [];
    _saveJournal(j);
    loadCheckin();
  }

  // ── Evening reflection ────────────────────────
  function _eveningReflection(day) {
    const tasks = day.tasks ?? [];
    const done  = day.done ?? [];
    const undone = tasks.map((t,i) => ({t,i})).filter(({i}) => !done.includes(i));

    return `<div class="card" style="margin-top:1rem;border:1.5px solid var(--primary,#6366f1)30" id="mujden-evening">
      <div class="card-header"><div class="card-title">🌙 Uzavřít den</div></div>
      <div class="card-body">
        <div class="form-group">
          <label class="form-label">Co se dnes povedlo?</label>
          <input id="mujden-win" class="form-control" placeholder="Největší výhra dne…" style="font-size:.875rem">
        </div>
        ${undone.length ? `<div class="form-group">
          <label class="form-label">Nesplněné úkoly — přesunout na zítra?</label>
          ${undone.map(({t,i}) => `<label style="display:flex;align-items:center;gap:.5rem;padding:.35rem 0;cursor:pointer;user-select:none">
            <input type="checkbox" id="ev-move-${i}" checked style="width:16px;height:16px;accent-color:var(--primary,#6366f1)">
            <span style="font-size:.85rem">${App.esc(t.text)}</span>
          </label>`).join('')}
        </div>` : ''}
        <div class="form-group">
          <label class="form-label">Jak hodnotíš den?</label>
          <div style="display:flex;gap:.5rem" id="mujden-mood-row">
            ${_MOODS.map((m,i) => `<button onclick="Todo._selectMood(${i})" data-mood="${i}"
              style="font-size:1.5rem;padding:.35rem .5rem;border-radius:10px;border:2px solid var(--border);background:var(--surface);cursor:pointer;transition:all .15s">${m}</button>`).join('')}
          </div>
        </div>
        <button class="btn btn-primary" style="width:100%;margin-top:.5rem;padding:.625rem" onclick="Todo.closeDay()">
          🌙 Uzavřít den
        </button>
      </div>
    </div>`;
  }

  let _selectedMood = null;
  function _selectMood(idx) {
    _selectedMood = idx;
    document.querySelectorAll('#mujden-mood-row button').forEach((b,i) => {
      b.style.borderColor = i===idx ? '#6366f1' : 'var(--border)';
      b.style.background  = i===idx ? '#6366f115' : 'var(--surface)';
      b.style.transform   = i===idx ? 'scale(1.2)' : '';
    });
  }

  function closeDay() {
    const j = _getJournal(); const dk = _today();
    const day = j[dk]; if (!day) return;
    const note = document.getElementById('mujden-win')?.value.trim() ?? '';
    const tasks = day.tasks ?? [];
    const done  = day.done ?? [];

    // Build tomorrow carry-over
    const undone = tasks.map((_,i)=>i).filter(i=>!done.includes(i));
    if (!day.tomorrow_tasks) day.tomorrow_tasks = [];
    undone.forEach(i => {
      const moveEl = document.getElementById(`ev-move-${i}`);
      if (moveEl && moveEl.checked) {
        day.tomorrow_tasks.push({ ...tasks[i], rolled:true, roll_count:(tasks[i].roll_count??0)+1 });
      }
    });

    day.evening_data = { note, mood: _selectedMood };
    _saveJournal(j);
    _selectedMood = null;

    const pct = tasks.length ? Math.round(done.length/tasks.length*100) : 0;
    App.toast(`Den uzavřen — ${pct}% splněno ${_MOODS[day.evening_data.mood]??''}`, 'success');
    loadCheckin();
  }

  // ── Closed day summary ────────────────────────
  function _closedDaySummary(day) {
    const tasks = day.tasks ?? [];
    const done  = day.done ?? [];
    const ev    = day.evening_data ?? {};
    const pct   = tasks.length ? Math.round(done.length/tasks.length*100) : 0;
    const barC  = pct>=80?'#10b981':pct>=50?'#f59e0b':'#ef4444';
    const emoji = pct===100?'🏆':pct>=80?'💪':pct>=50?'👍':'💬';

    const taskRows = tasks.map((t, i) => {
      const isDone = done.includes(i);
      return `<div style="display:flex;align-items:center;gap:.5rem;padding:.2rem 0;font-size:.82rem;${isDone?'color:var(--text-muted)':''}">
        <span style="font-size:.75rem">${isDone?'✅':'⬜'}</span>
        <span style="${isDone?'text-decoration:line-through':'font-weight:500'}">${App.esc(t.text)}</span>
      </div>`;
    }).join('');

    return `<div class="card" style="margin-top:1rem">
      <div class="card-header">
        <div class="card-title">${emoji} Den uzavřen</div>
        <span style="font-weight:700;color:${barC}">${pct}%</span>
      </div>
      <div class="card-body">
        ${ev.note ? `<div style="background:var(--surface2);border-radius:8px;padding:.5rem .75rem;font-size:.85rem;margin-bottom:.75rem">🏆 ${App.esc(ev.note)}</div>` : ''}
        ${ev.mood!==null&&ev.mood!==undefined ? `<div style="font-size:.85rem;color:var(--text-muted);margin-bottom:.5rem">Nálada: ${_MOODS[ev.mood]}</div>` : ''}
        ${tasks.length ? `<div style="border-top:1px solid var(--border);padding-top:.625rem;margin-top:.375rem">${taskRows}</div>` : ''}
        <div style="display:flex;gap:.5rem;margin-top:.75rem">
          <button class="btn btn-sm btn-outline" onclick="Todo.reopenDay()">🔓 Znovu otevřít den</button>
        </div>
      </div>
    </div>`;
  }

  function reopenDay() {
    const j = _getJournal(); const dk = _today();
    const oldNote = j[dk]?.evening_data?.note ?? '';
    const oldMood = j[dk]?.evening_data?.mood ?? null;
    if (j[dk]) { delete j[dk].evening_data; j[dk].tomorrow_tasks = []; }
    _saveJournal(j);
    loadCheckin();
    setTimeout(() => {
      const inp = document.getElementById('mujden-win');
      if (inp && oldNote) inp.value = oldNote;
      if (oldMood !== null) { _selectedMood = oldMood; _selectMood(oldMood); }
    }, 50);
  }

  // ── Nadcházející dny ──────────────────────────
  function _upcomingSection(j) {
    const rows = [];
    for (let i = 1; i <= 5; i++) {
      const d = new Date(_today()+'T00:00:00');
      d.setDate(d.getDate() + i);
      const dk = d.toISOString().split('T')[0];
      const day = j[dk];
      if (!day) continue;
      const tasks = [
        ...(day.tasks ?? []),
        ...(day.tomorrow_tasks ?? []),
      ];
      if (!tasks.length) continue;
      const label = d.toLocaleDateString('cs-CZ', { weekday:'long', day:'numeric', month:'short' });
      rows.push(`<div style="margin-bottom:.625rem">
        <div style="font-size:.75rem;font-weight:600;color:var(--text-muted);margin-bottom:.3rem;text-transform:capitalize">${label}</div>
        ${tasks.map(t => {
          const cat = _CATEGORIES.find(c=>c.key===t.category) ?? _CATEGORIES[0];
          return `<div style="display:flex;align-items:center;gap:.4rem;padding:.3rem .5rem;border-radius:8px;background:var(--surface);border:1px solid var(--border);margin-bottom:.2rem;font-size:.82rem">
            <span style="font-size:.75rem">${cat.emoji}</span>
            <span style="flex:1;${t.rolled?'color:var(--text-muted)':''}">${App.esc(t.text)}</span>
            ${t.time?`<span style="font-size:.7rem;color:var(--text-muted)">🕐 ${t.time}</span>`:''}
          </div>`;
        }).join('')}
      </div>`);
    }
    if (!rows.length) return '';
    return `<div style="margin-top:1.25rem">
      <div style="font-size:.75rem;font-weight:600;color:var(--text-muted);text-transform:uppercase;letter-spacing:.05em;margin-bottom:.625rem">📅 Nadcházející dny</div>
      ${rows.join('')}
    </div>`;
  }

  // ── History with expandable cards ─────────────
  function _historySection(journal) {
    const days = Object.keys(journal).filter(k => k!==_today() && journal[k]?.tasks?.length).sort().reverse().slice(0,14);
    if (!days.length) return '';

    const rows = days.map(dk => {
      const day = journal[dk];
      _migrateDay(day);
      const tasks = day.tasks ?? [];
      const done  = day.done ?? [];
      const ev    = day.evening_data ?? {};
      const pct   = tasks.length ? Math.round(done.length/tasks.length*100) : 0;
      const barC  = pct>=80?'#10b981':pct>=50?'#f59e0b':'#ef4444';
      const dayName = new Date(dk+'T00:00:00').toLocaleDateString('cs-CZ',{weekday:'short',day:'numeric',month:'short'});
      const moodStr = ev.mood!==null&&ev.mood!==undefined ? _MOODS[ev.mood] : '';

      const detail = tasks.map((t,i) => {
        const d = done.includes(i);
        return `<div style="font-size:.82rem;padding:.15rem 0;${d?'color:var(--text-muted);text-decoration:line-through':''}">${d?'✓':'→'} ${App.esc(t.text)}</div>`;
      }).join('');

      return `<div style="border-bottom:1px solid var(--border)">
        <button onclick="this.nextElementSibling.style.display=this.nextElementSibling.style.display==='none'?'block':'none'"
          style="width:100%;display:flex;align-items:center;gap:.5rem;padding:.625rem .25rem;border:none;background:none;cursor:pointer;text-align:left">
          <span style="font-size:.85rem;font-weight:600;flex:1">${dayName}</span>
          <span style="font-size:.75rem;color:var(--text-muted)">${done.length}/${tasks.length}</span>
          <span style="font-size:.75rem;font-weight:700;color:${barC}">${pct}%</span>
          ${moodStr?`<span>${moodStr}</span>`:''}
          <span style="font-size:.7rem;color:var(--text-muted)">▼</span>
        </button>
        <div style="display:none;padding:0 .5rem .625rem .5rem">
          ${detail}
          ${ev.note?`<div style="font-size:.8rem;color:var(--text-muted);margin-top:.35rem;background:var(--surface2);padding:.35rem .5rem;border-radius:6px">🏆 ${App.esc(ev.note)}</div>`:''}
        </div>
      </div>`;
    }).join('');

    return `<div class="card" style="margin-top:1rem">
      <div class="card-header"><div class="card-title">📅 Historie</div></div>
      <div class="card-body" style="padding:0 .875rem">${rows}</div>
    </div>`;
  }

  // ── Task actions ──────────────────────────────
  function addTask() {
    const input = document.getElementById('mujden-input');
    const text = input?.value.trim();
    if (!text) return;
    const j = _getJournal(); const dk = _today();
    if (!j[dk]) j[dk] = {};
    if (!j[dk].tasks) j[dk].tasks = [];
    if (!j[dk].done)  j[dk].done  = [];
    j[dk].tasks.push({ text, priority:'yellow', category:_categorize(text), rolled:false, from_chain:false, roll_count:0 });
    _saveJournal(j);
    loadCheckin();
  }

  function toggleTask(idx) {
    const j = _getJournal(); const dk = _today();
    if (!j[dk]?.tasks) return;
    if (!j[dk].done) j[dk].done = [];
    const pos = j[dk].done.indexOf(idx);
    if (pos >= 0) j[dk].done.splice(pos,1);
    else j[dk].done.push(idx);
    _saveJournal(j);
    loadCheckin();
  }

  function cyclePriority(idx) {
    const j = _getJournal(); const dk = _today();
    const t = j[dk]?.tasks?.[idx]; if (!t) return;
    const cycle = { yellow:'red', red:'green', green:'yellow' };
    t.priority = cycle[t.priority] ?? 'yellow';
    _saveJournal(j);
    loadCheckin();
  }

  function postponeTask(idx, days) {
    const j = _getJournal(); const dk = _today();
    const tasks = j[dk]?.tasks; if (!tasks?.[idx]) return;
    const t = tasks[idx];
    // Target day key
    const target = new Date(_today()+'T00:00:00');
    target.setDate(target.getDate() + days);
    const tdk = target.toISOString().split('T')[0];
    if (!j[tdk]) j[tdk] = {};
    if (!j[tdk].tasks) j[tdk].tasks = [];
    if (!j[tdk].done) j[tdk].done = [];
    j[tdk].tasks.push({ ...t, rolled: true, from_chain: false, roll_count: (t.roll_count??0)+1 });
    // Remove from today
    tasks.splice(idx, 1);
    j[dk].done = (j[dk].done??[]).filter(i=>i!==idx).map(i=>i>idx?i-1:i);
    _saveJournal(j);
    App.closeModal();
    const label = days===1?'zítra':days===2?'pozítří':`za ${days} dny`;
    App.toast(`Úkol přesunut na ${label}`, 'success');
    loadCheckin();
  }

  function deleteTask(idx) {
    if (!confirm('Smazat tento úkol?')) return;
    const j = _getJournal(); const dk = _today();
    if (!j[dk]?.tasks) return;
    j[dk].tasks.splice(idx, 1);
    // Remap done indices
    j[dk].done = (j[dk].done??[]).filter(i=>i!==idx).map(i=>i>idx?i-1:i);
    _saveJournal(j);
    loadCheckin();
  }

  function moveTask(idx, dir) {
    const j = _getJournal(); const dk = _today();
    const tasks = j[dk]?.tasks; if (!tasks) return;
    const ni = idx+dir;
    if (ni<0||ni>=tasks.length) return;
    // Remap done indices for the swap
    const done = j[dk].done ?? [];
    j[dk].done = done.map(d => d===idx ? ni : d===ni ? idx : d);
    [tasks[idx], tasks[ni]] = [tasks[ni], tasks[idx]];
    _saveJournal(j);
    loadCheckin();
  }

  function openTaskMenu(idx) {
    const j = _getJournal(); const dk = _today();
    const t = j[dk]?.tasks?.[idx]; if (!t) return;
    const pipeline = t.pipeline_stage ? _PIPELINE.find(p=>p.key===t.pipeline_stage) : null;
    App.openModal('⚙️ '+App.esc(t.text), `
      <div style="display:flex;flex-direction:column;gap:.5rem">
        <button onclick="Todo.moveTask(${idx},-1);App.closeModal()" class="btn btn-outline" style="text-align:left" ${idx===0?'disabled':''}>↑ Posunout nahoru</button>
        <button onclick="Todo.moveTask(${idx},1);App.closeModal()" class="btn btn-outline" style="text-align:left" ${idx>=(j[dk].tasks.length-1)?'disabled':''}>↓ Posunout dolů</button>
        <hr style="border:none;border-top:1px solid var(--border);margin:.25rem 0">
        <button onclick="Todo.postponeTask(${idx},1)" class="btn btn-outline" style="text-align:left">📅 Přesunout na zítra</button>
        <button onclick="Todo.postponeTask(${idx},2)" class="btn btn-outline" style="text-align:left">📅 Přesunout na pozítří</button>
        <hr style="border:none;border-top:1px solid var(--border);margin:.25rem 0">
        <button onclick="Todo.openPipelineDialog('${dk}',${idx})" class="btn btn-outline" style="text-align:left">🤝 Pipeline stav ${pipeline?'('+pipeline.emoji+')':''}</button>
        <button onclick="Todo.openDelegateDialog('${dk}',${idx})" class="btn btn-outline" style="text-align:left">👤 Delegovat ${t.delegated_to?'('+App.esc(t.delegated_to)+')':''}</button>
        <button onclick="Todo.setTaskTime(${idx})" class="btn btn-outline" style="text-align:left">🕐 Nastavit čas ${t.time?'('+t.time+')':''}</button>
        <hr style="border:none;border-top:1px solid var(--border);margin:.25rem 0">
        <button onclick="Todo.deleteTask(${idx});App.closeModal()" class="btn btn-outline" style="text-align:left;color:var(--danger,#ef4444)">🗑 Smazat úkol</button>
      </div>
    `);
  }

  function setTaskTime(idx) {
    const j = _getJournal(); const dk = _today();
    const t = j[dk]?.tasks?.[idx]; if (!t) return;
    App.openModal('🕐 Nastavit čas úkolu', `
      <p style="font-size:.8rem;background:var(--surface2);padding:.5rem .75rem;border-radius:8px;margin-bottom:.875rem"><strong>${App.esc(t.text)}</strong></p>
      <div class="form-group">
        <label class="form-label">Čas</label>
        <input id="task-time-input" class="form-control" type="time" value="${t.time??''}" placeholder="10:00">
      </div>
      <div style="display:flex;gap:.5rem;margin-top:.75rem">
        <button class="btn btn-primary" style="flex:1" onclick="Todo._saveTaskTime(${idx})">Uložit</button>
        <button class="btn btn-outline" onclick="Todo._saveTaskTime(${idx},true)">Smazat čas</button>
      </div>
    `);
    setTimeout(() => document.getElementById('task-time-input')?.focus(), 50);
  }

  function _saveTaskTime(idx, clear=false) {
    const val = clear ? '' : (document.getElementById('task-time-input')?.value ?? '');
    const j = _getJournal(); const dk = _today();
    const t = j[dk]?.tasks?.[idx]; if (!t) return;
    t.time = val.trim() || undefined;
    _saveJournal(j);
    App.closeModal();
    loadCheckin();
  }

  // ── Delegace ──────────────────────────────────
  function openDelegateDialog(dk, idx) {
    const j = _getJournal();
    const task = j[dk]?.tasks?.[idx]; if (!task) return;
    const existing = !!task.delegated_to;
    const defaultDue = (() => { const d=new Date();d.setDate(d.getDate()+7);return d.toISOString().split('T')[0]; })();
    App.openModal(existing ? '👤 Upravit delegaci' : '👤 Delegovat úkol', `
      <p style="font-size:.8rem;background:var(--surface2);padding:.5rem .75rem;border-radius:8px;margin-bottom:.875rem"><strong>${App.esc(task.text)}</strong></p>
      <div class="form-group">
        <label class="form-label">Delegovat na</label>
        <input id="deleg-to" class="form-control" list="deleg-to-list" placeholder="Jméno / role" value="${App.esc(task.delegated_to??'')}">
        <datalist id="deleg-to-list"><option value="Presales"><option value="Asistentka"><option value="Kolega"><option value="Manažer"><option value="IT"><option value="Účetní"></datalist>
      </div>
      <div class="form-group">
        <label class="form-label">Termín</label>
        <input id="deleg-due" type="date" class="form-control" value="${task.delegated_due??defaultDue}">
      </div>
      <div class="form-group">
        <label class="form-label">Poznámka</label>
        <input id="deleg-note" class="form-control" placeholder="Co přesně mají udělat…" value="${App.esc(task.delegated_note??'')}">
      </div>
      ${existing&&!task.delegated_done?`<div style="margin-top:.5rem;padding-top:.75rem;border-top:1px solid var(--border)">
        <button class="btn btn-sm" style="background:#10b98115;color:#10b981;border:1px solid #10b98140" onclick="Todo.markDelegatedDone('${dk}',${idx})">✅ Přijato / splněno</button>
      </div>`:''}
    `, { saveLabel: existing?'Uložit':'Delegovat', onSave: () => saveDelegation(dk, idx) });
  }

  function saveDelegation(dk, idx) {
    const to=document.getElementById('deleg-to')?.value.trim();
    if (!to) { App.toast('Zadej osobu.','error'); return; }
    const j=_getJournal(); const task=j[dk]?.tasks?.[idx]; if(!task) return;
    task.delegated_to=to;
    task.delegated_due=document.getElementById('deleg-due')?.value||null;
    task.delegated_note=document.getElementById('deleg-note')?.value.trim()||null;
    task.delegated_date=task.delegated_date||_today();
    task.delegated_done=false;
    _saveJournal(j); App.closeModal(); App.toast('Delegace uložena ✓','success'); loadCheckin();
  }

  function markDelegatedDone(dk, idx) {
    const j=_getJournal(); const task=j[dk]?.tasks?.[idx]; if(!task) return;
    task.delegated_done=true; _saveJournal(j); App.closeModal(); App.toast('Přijato ✓','success'); loadCheckin();
  }

  // ── Pipeline dialog ───────────────────────────
  function openPipelineDialog(dk, idx) {
    const j=_getJournal(); const task=j[dk]?.tasks?.[idx]; if(!task) return;
    const opts = _PIPELINE.map(p => `
      <button onclick="Todo.setPipelineStage('${dk}',${idx},'${p.key}')"
        style="display:flex;align-items:center;gap:.625rem;width:100%;padding:.5rem .75rem;border-radius:8px;border:1.5px solid ${task.pipeline_stage===p.key?p.color:'var(--border)'};background:${task.pipeline_stage===p.key?p.color+'15':'var(--surface2)'};cursor:pointer;text-align:left;margin-bottom:.3rem">
        <span style="font-size:1.1rem">${p.emoji}</span>
        <span style="font-size:.85rem;font-weight:${task.pipeline_stage===p.key?'700':'400'};color:${task.pipeline_stage===p.key?p.color:'var(--text)'}">${p.label}</span>
      </button>`).join('');
    App.openModal('🤝 Pipeline', `
      <p style="font-size:.8rem;color:var(--text-muted);margin-bottom:.75rem;background:var(--surface2);padding:.5rem .75rem;border-radius:8px">${App.esc(task.text)}</p>
      ${opts}
      ${task.pipeline_stage?`<button onclick="Todo.setPipelineStage('${dk}',${idx},null)" style="width:100%;padding:.35rem;font-size:.8rem;border:1px solid var(--border);border-radius:8px;background:var(--surface);color:var(--text-muted);cursor:pointer;margin-top:.25rem">✕ Odebrat</button>`:''}
    `);
  }

  function setPipelineStage(dk, idx, stage) {
    const j=_getJournal(); const task=j[dk]?.tasks?.[idx]; if(!task) return;
    task.pipeline_stage=stage||undefined; _saveJournal(j); App.closeModal(); loadCheckin();
  }

  // ── Delegováno tab ────────────────────────────
  function loadDelegated() {
    const el = document.getElementById('todo-tab-delegovano');
    if (!el) return;
    const j = _getJournal();
    const today = new Date(_today()+'T00:00:00');
    const delegations = [];
    Object.entries(j).forEach(([dk, day]) => {
      _migrateDay(day);
      (day.tasks??[]).forEach((t, idx) => {
        if (!t.delegated_to) return;
        const dueDate = t.delegated_due ? new Date(t.delegated_due+'T00:00:00') : null;
        const diffDays = dueDate ? Math.round((dueDate-today)/86400000) : null;
        delegations.push({ dk, idx, t, diffDays, overdue: diffDays!==null&&diffDays<0, done: !!t.delegated_done });
      });
    });

    if (!delegations.length) {
      el.innerHTML = `<div class="empty-state"><div class="empty-icon">👤</div><div class="empty-title">Žádné delegace</div><div class="empty-text">Deleguj úkol přes ⋯ menu v denním plánu.</div></div>`;
      return;
    }

    const active  = delegations.filter(d=>!d.done).sort((a,b)=>(a.overdue===b.overdue?0:a.overdue?-1:1)||(a.diffDays??999)-(b.diffDays??999));
    const done    = delegations.filter(d=>d.done);
    const overCnt = active.filter(d=>d.overdue).length;

    const renderRow = ({dk,idx,t,diffDays,overdue,done:isDone}) => {
      const daysText = diffDays===null?'bez termínu':overdue?`${Math.abs(diffDays)} dní po termínu`:diffDays===0?'dnes':`za ${diffDays} dní`;
      const c = isDone?'#10b981':overdue?'#ef4444':diffDays!==null&&diffDays<=2?'#f59e0b':'var(--text-muted)';
      return `<div style="display:flex;align-items:flex-start;gap:.5rem;padding:.5rem .625rem;border-radius:8px;background:${overdue&&!isDone?'#ef444408':'var(--surface2)'};margin-bottom:.35rem;border:1px solid ${overdue&&!isDone?'#ef444430':'transparent'};${isDone?'opacity:.6':''}">
        <div style="flex:1;min-width:0">
          <div style="font-size:.875rem;font-weight:500;${isDone?'text-decoration:line-through':''}">${App.esc(t.text)}</div>
          <div style="font-size:.72rem;color:${c};margin-top:.1rem">
            👤 <strong>${App.esc(t.delegated_to)}</strong> · ${daysText}
            ${t.delegated_note?` · 📝 ${App.esc(t.delegated_note)}`:''}
          </div>
        </div>
        ${!isDone?`<div style="display:flex;gap:.2rem;flex-shrink:0">
          <button onclick="Todo.markDelegatedDone('${dk}',${idx})" style="padding:.2rem .45rem;font-size:.72rem;border:1px solid #10b98140;border-radius:6px;background:#10b98112;color:#10b981;cursor:pointer">✅</button>
          <button onclick="Todo.openDelegateDialog('${dk}',${idx})" style="padding:.2rem .45rem;font-size:.72rem;border:1px solid var(--border);border-radius:6px;background:var(--surface);cursor:pointer">✏️</button>
        </div>`:''}
      </div>`;
    };

    let html = '';
    if (overCnt) html += `<div style="background:#ef444410;border:1px solid #ef444430;border-radius:8px;padding:.5rem .75rem;font-size:.85rem;color:#ef4444;font-weight:600;margin-bottom:.75rem">⚠️ ${overCnt} delegac${overCnt>1?'í':'e'} po termínu</div>`;
    if (active.length) {
      html += `<div style="font-size:.72rem;font-weight:700;text-transform:uppercase;letter-spacing:.07em;color:var(--text-muted);margin-bottom:.35rem">Čeká na splnění (${active.length})</div>`;
      html += active.map(renderRow).join('');
    }
    if (done.length) {
      html += `<div style="font-size:.72rem;font-weight:700;text-transform:uppercase;letter-spacing:.07em;color:var(--text-muted);margin:.75rem 0 .35rem">Dokončené (${done.length})</div>`;
      html += done.map(renderRow).join('');
    }
    el.innerHTML = html;
  }

  // ── Dashboard status ──────────────────────────
  function getDashStatus() {
    const j = _getJournal(); const day = j[_today()] ?? {};
    _migrateDay(day);
    const tasks = day.tasks ?? [];
    const done  = day.done ?? [];
    const pct   = tasks.length ? Math.round(done.length/tasks.length*100) : null;
    const streak = _calcStreak(j);
    let stalest = 0;
    tasks.forEach(t => { if ((t.roll_count??0)>stalest) stalest=t.roll_count; });
    return { hasMorning: tasks.length>0, hasEvening: !!day.evening_data, tasks:tasks.length, done:done.length, pct, streak, stalest };
  }

  // ── Export ────────────────────────────────────
  return {
    load, toggle, openEdit, delete: deleteTodo,
    loadCheckin, loadDelegated, addTask, toggleTask, cyclePriority,
    deleteTask, postponeTask, moveTask, openTaskMenu, setTaskTime, _saveTaskTime,
    openDelegateDialog, saveDelegation, markDelegatedDone,
    openPipelineDialog, setPipelineStage, importDbTask,
    closeDay, reopenDay, _selectMood,
    getDashStatus,
  };
})();


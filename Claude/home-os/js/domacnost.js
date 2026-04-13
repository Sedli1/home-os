/* ═══════════════════════════════════════════════
   Home OS — modul Domácnost
   ═══════════════════════════════════════════════ */

const Domacnost = (() => {
  let activeTab = 'nakup';
  let familyMembers = [];

  async function load() {
    // Načíst členy rodiny pro nákupní seznam
    const { data: mems } = await db.from('family_members').select('id,name,color').order('name');
    familyMembers = mems ?? [];

    document.querySelectorAll('#page-domacnost .tab-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        activeTab = btn.dataset.tab;
        document.querySelectorAll('#page-domacnost .tab-btn').forEach(b => b.classList.remove('active'));
        document.querySelectorAll('#page-domacnost .tab-panel').forEach(p => p.classList.remove('active'));
        btn.classList.add('active');
        document.getElementById(`dom-tab-${activeTab}`)?.classList.add('active');
        loadTab(activeTab);
      });
    });

    loadTab(activeTab);

    document.getElementById('addWarrantyBtn')?.addEventListener('click', openAddWarranty);

    // Quick-add nákupní seznam
    const quickInput = document.getElementById('shopQuickInput');
    const quickBtn   = document.getElementById('shopQuickAdd');

    // Dynamicky vygenerovat member select pokud je potřeba
    const memberSelect = document.getElementById('shopMemberSelect');
    if (memberSelect && familyMembers.length) {
      memberSelect.innerHTML = `<option value="">— pro koho —</option>` +
        familyMembers.map(m => `<option value="${m.id}">${App.esc(m.name)}</option>`).join('');
      memberSelect.style.display = '';
    }

    function addShopItem() {
      const val = quickInput?.value.trim();
      if (!val) return;
      const memberId = document.getElementById('shopMemberSelect')?.value || null;
      db.from('shopping_list').insert({
        item: val,
        member_id: memberId,
      }).then(({ error }) => {
        if (error) { App.toast('Chyba: ' + error.message, 'error'); return; }
        quickInput.value = '';
        if (document.getElementById('shopMemberSelect')) document.getElementById('shopMemberSelect').value = '';
        loadShoppingList();
      });
    }

    quickBtn?.addEventListener('click', addShopItem);
    quickInput?.addEventListener('keydown', (e) => { if (e.key === 'Enter') addShopItem(); });
  }

  function loadTab(tab) {
    switch (tab) {
      case 'nakup':    loadShoppingList(); break;
      case 'zaruky':   loadWarranties(); break;
    }
  }

  // ── Nákupní seznam ──────────────────────────
  async function loadShoppingList() {
    const el = document.getElementById('shop-list');
    el.innerHTML = '<div class="loading"><div class="spinner"></div> Načítám…</div>';

    const { data, error } = await db
      .from('shopping_list')
      .select('*, family_members(id,name,color)')
      .order('done')
      .order('created_at', { ascending: false });

    if (error) { el.innerHTML = `<div class="empty-state"><div class="empty-text">Chyba: ${App.esc(error.message)}</div></div>`; return; }

    if (!data.length) {
      el.innerHTML = '<div class="empty-state"><div class="empty-icon">🛒</div><div class="empty-title">Seznam je prázdný</div><div class="empty-text">Přidejte položky výše.</div></div>';
      return;
    }

    el.innerHTML = data.map(item => `
      <div class="shop-item ${item.done ? 'done' : ''}" data-id="${item.id}">
        <div class="shop-check ${item.done ? 'checked' : ''}"
          onclick="Domacnost.toggleShopItem('${item.id}', ${item.done})"></div>
        <span class="shop-name">${App.esc(item.item)}</span>
        ${item.quantity ? `<span class="shop-qty">${App.esc(item.quantity)}</span>` : ''}
        ${item.family_members ? `<span style="font-size:.72rem;font-weight:600;padding:.1rem .4rem;border-radius:99px;background:${item.family_members.color ?? '#6366f1'}18;color:${item.family_members.color ?? '#6366f1'};border:1px solid ${item.family_members.color ?? '#6366f1'}33">${App.esc(item.family_members.name)}</span>` : ''}
        <button class="btn btn-icon btn-ghost btn-sm" onclick="Domacnost.deleteShopItem('${item.id}')" style="margin-left:auto">✕</button>
      </div>
    `).join('');

    // Tlačítko "Vymazat dokoupené"
    const doneCount = data.filter(i => i.done).length;
    if (doneCount > 0) {
      el.insertAdjacentHTML('afterend', `
        <div style="margin-top:.75rem;text-align:right" id="clearDoneWrap">
          <button class="btn btn-sm btn-outline" onclick="Domacnost.clearDoneItems()">
            🗑️ Vymazat dokoupené (${doneCount})
          </button>
        </div>
      `);
    } else {
      document.getElementById('clearDoneWrap')?.remove();
    }
  }

  async function toggleShopItem(id, isDone) {
    await db.from('shopping_list').update({ done: !isDone }).eq('id', id);
    loadShoppingList();
  }

  async function deleteShopItem(id) {
    await db.from('shopping_list').delete().eq('id', id);
    loadShoppingList();
  }

  async function clearDoneItems() {
    await db.from('shopping_list').delete().eq('done', true);
    App.toast('Hotové položky smazány.', '');
    loadShoppingList();
  }

  // ── Záruky ───────────────────────────────────
  async function loadWarranties() {
    const el = document.getElementById('warranties-list');
    el.innerHTML = '<div class="loading"><div class="spinner"></div> Načítám…</div>';

    const { data, error } = await db
      .from('warranties')
      .select('*')
      .order('warranty_end');

    if (error) { el.innerHTML = `<div class="empty-state"><div class="empty-text">Chyba: ${App.esc(error.message)}</div></div>`; return; }

    if (!data.length) {
      el.innerHTML = '<div class="empty-state"><div class="empty-icon">📋</div><div class="empty-title">Žádné záruky</div><div class="empty-text">Přidejte spotřebiče a jejich záruky.</div></div>';
      return;
    }

    el.innerHTML = data.map(w => {
      const days = w.warranty_end ? App.daysUntil(w.warranty_end) : null;
      return `<div class="warranty-item">
        <div style="font-size:1.5rem">📦</div>
        <div class="warranty-body">
          <div class="warranty-name">${App.esc(w.name)}</div>
          <div class="warranty-meta">
            ${w.store ? `🏪 ${App.esc(w.store)} · ` : ''}
            ${w.purchase_date ? `Koupeno ${App.formatDate(w.purchase_date)} · ` : ''}
            ${w.price ? App.formatMoney(w.price) : ''}
          </div>
          ${w.warranty_end ? `<div style="margin-top:.25rem;font-size:.8125rem">
            Záruka do ${App.formatDate(w.warranty_end)}
          </div>` : ''}
        </div>
        <div style="display:flex;align-items:center;gap:.5rem">
          ${days !== null ? App.countdownBadge(days) : ''}
          <button class="btn btn-icon btn-ghost btn-sm" onclick="Domacnost.deleteWarranty('${w.id}')">🗑️</button>
        </div>
      </div>`;
    }).join('');
  }

  function openAddWarranty() {
    App.openModal('📦 Nová záruka', `
      <div class="form-group">
        <label class="form-label">Název spotřebiče *</label>
        <input id="w-name" class="form-control" placeholder="např. Pračka Bosch">
      </div>
      <div class="form-row">
        <div class="form-group">
          <label class="form-label">Obchod</label>
          <input id="w-store" class="form-control" placeholder="Alza, Datart…">
        </div>
        <div class="form-group">
          <label class="form-label">Cena (Kč)</label>
          <input id="w-price" type="number" class="form-control" placeholder="0">
        </div>
      </div>
      <div class="form-row">
        <div class="form-group">
          <label class="form-label">Datum koupě</label>
          <input id="w-bought" type="date" class="form-control">
        </div>
        <div class="form-group">
          <label class="form-label">Záruka do</label>
          <input id="w-end" type="date" class="form-control">
        </div>
      </div>
      <div class="form-group">
        <label class="form-label">Poznámka</label>
        <input id="w-notes" class="form-control" placeholder="číslo dokladu, sériové číslo…">
      </div>
    `, {
      saveLabel: 'Přidat',
      onSave: async () => {
        const name = document.getElementById('w-name')?.value.trim();
        if (!name) { App.toast('Zadejte název.', 'error'); return; }
        const { error } = await db.from('warranties').insert({
          name,
          store:         document.getElementById('w-store')?.value.trim() || null,
          price:         parseFloat(document.getElementById('w-price')?.value) || null,
          purchase_date: document.getElementById('w-bought')?.value || null,
          warranty_end:  document.getElementById('w-end')?.value || null,
          notes:         document.getElementById('w-notes')?.value.trim() || null,
        });
        if (error) { App.toast('Chyba: ' + error.message, 'error'); return; }
        App.toast('Přidáno ✓', 'success');
        App.closeModal();
        loadWarranties();
      }
    });
  }

  async function deleteWarranty(id) {
    if (!confirm('Smazat záruku?')) return;
    await db.from('warranties').delete().eq('id', id);
    App.toast('Smazáno.', '');
    loadWarranties();
  }

  return { load, toggleShopItem, deleteShopItem, clearDoneItems, deleteWarranty };
})();

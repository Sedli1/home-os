/* ═══════════════════════════════════════════════
   Home OS — PIN Lock
   Přidává lokální uzamknutí UI po nečinnosti.
   Data jsou uložena v Supabase (šifrováno na serveru).
   PIN slouží jako ochrana před fyzickým přístupem k odemčenému prohlížeči.
   ═══════════════════════════════════════════════ */

const PinLock = (() => {
  const STORE_HASH    = 'hpos_pin_hash';
  const STORE_SESSION = 'hpos_pin_ok';
  const IDLE_MS       = 15 * 60 * 1000; // 15 minut nečinnosti
  const HIDDEN_MS     = 60 * 1000;       // 1 min v pozadí

  let _idleTimer  = null;
  let _locked     = false;

  // ── Kryptografie ─────────────────────────────
  async function _sha256(text) {
    const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text));
    return Array.from(new Uint8Array(buf)).map(b => b.toString(16).padStart(2, '0')).join('');
  }

  // ── Stav ──────────────────────────────────────
  function hasPIN()     { return !!localStorage.getItem(STORE_HASH); }
  function isUnlocked() { return sessionStorage.getItem(STORE_SESSION) === '1'; }

  // ── Lock / Unlock ──────────────────────────────
  function _showLock() {
    _locked = true;
    clearTimeout(_idleTimer);
    const el = document.getElementById('pinLockScreen');
    if (el) el.style.display = 'flex';
    setTimeout(() => document.getElementById('pinInput')?.focus(), 100);
  }

  function _hideLock() {
    _locked = false;
    const el = document.getElementById('pinLockScreen');
    if (el) el.style.display = 'none';
    sessionStorage.setItem(STORE_SESSION, '1');
    _startIdleTimer();
  }

  // ── Idle timer ────────────────────────────────
  function _startIdleTimer() {
    clearTimeout(_idleTimer);
    if (!hasPIN()) return;
    _idleTimer = setTimeout(() => {
      sessionStorage.removeItem(STORE_SESSION);
      _showLock();
    }, IDLE_MS);
  }

  function _resetIdleTimer() {
    if (!_locked && hasPIN()) _startIdleTimer();
  }

  // ── Init ──────────────────────────────────────
  function init() {
    if (!hasPIN()) return;
    if (isUnlocked()) {
      _startIdleTimer();
    } else {
      _showLock();
    }

    // Aktivita uživatele
    ['mousemove', 'keydown', 'click', 'touchstart', 'scroll'].forEach(ev => {
      document.addEventListener(ev, _resetIdleTimer, { passive: true });
    });

    // Zamknout při schovávání záložky
    let _hiddenStart = null;
    document.addEventListener('visibilitychange', () => {
      if (document.hidden) {
        _hiddenStart = Date.now();
        clearTimeout(_idleTimer);
      } else {
        const away = Date.now() - (_hiddenStart ?? 0);
        if (hasPIN() && away > HIDDEN_MS) {
          sessionStorage.removeItem(STORE_SESSION);
          _showLock();
        } else if (!_locked && hasPIN()) {
          _startIdleTimer();
        }
      }
    });
  }

  // ── Odemknout PINem ───────────────────────────
  async function tryUnlock() {
    const pinInput = document.getElementById('pinInput');
    const pinError = document.getElementById('pinError');
    const pin = pinInput?.value ?? '';
    if (!pin) return;

    const hash = await _sha256(pin);
    if (hash === localStorage.getItem(STORE_HASH)) {
      pinInput.value = '';
      if (pinError) pinError.style.display = 'none';
      _hideLock();
    } else {
      pinInput.value = '';
      if (pinError) pinError.style.display = 'block';
      pinInput?.focus();
    }
  }

  // ── Nastavit/Změnit PIN ───────────────────────
  function openSetup() {
    const existing = hasPIN();
    App.openModal(existing ? '🔑 Změnit PIN' : '🔑 Nastavit PIN zámek', `
      <p style="font-size:.875rem;color:var(--text-muted);margin-bottom:1rem">
        PIN zamkne aplikaci po ${IDLE_MS / 60000} minutách nečinnosti nebo při přepnutí záložky.
        Citlivá data jsou uložena v Supabase — PIN chrání přístup k odemčenému prohlížeči.
      </p>
      ${existing ? `<div class="form-group">
        <label class="form-label">Aktuální PIN</label>
        <input id="pin-old" type="password" class="form-control" placeholder="••••" inputmode="numeric" maxlength="16" autocomplete="current-password">
      </div>` : ''}
      <div class="form-group">
        <label class="form-label">Nový PIN (min. 4 znaky)</label>
        <input id="pin-new" type="password" class="form-control" placeholder="••••" inputmode="numeric" maxlength="16" autocomplete="new-password">
      </div>
      <div class="form-group">
        <label class="form-label">Potvrdit PIN</label>
        <input id="pin-confirm" type="password" class="form-control" placeholder="••••" inputmode="numeric" maxlength="16">
      </div>
      ${existing ? `<div style="margin-top:.5rem;padding-top:.75rem;border-top:1px solid var(--border)">
        <button class="btn btn-sm btn-ghost" style="color:var(--danger)" onclick="PinLock._confirmRemove()">🗑️ Odebrat PIN zámek</button>
      </div>` : ''}
    `, {
      saveLabel: existing ? 'Změnit PIN' : 'Aktivovat PIN',
      onSave: async () => {
        if (existing) {
          const old = document.getElementById('pin-old')?.value ?? '';
          if (!old) { App.toast('Zadejte aktuální PIN.', 'error'); return; }
          const oldHash = await _sha256(old);
          if (oldHash !== localStorage.getItem(STORE_HASH)) {
            App.toast('Nesprávný aktuální PIN.', 'error');
            return;
          }
        }
        const newPin = document.getElementById('pin-new')?.value ?? '';
        const confirm = document.getElementById('pin-confirm')?.value ?? '';
        if (newPin.length < 4) { App.toast('PIN musí mít alespoň 4 znaky.', 'error'); return; }
        if (newPin !== confirm) { App.toast('PINy se neshodují.', 'error'); return; }
        const hash = await _sha256(newPin);
        localStorage.setItem(STORE_HASH, hash);
        sessionStorage.setItem(STORE_SESSION, '1');
        _startIdleTimer();
        App.closeModal();
        App.toast('PIN nastaven ✓', 'success');
      }
    });
  }

  function _confirmRemove() {
    App.closeModal();
    if (confirm('Odebrat PIN? Aplikace nebude dál uzamknutá.')) {
      localStorage.removeItem(STORE_HASH);
      sessionStorage.removeItem(STORE_SESSION);
      clearTimeout(_idleTimer);
      App.toast('PIN odebrán.', 'success');
    }
  }

  return { init, tryUnlock, openSetup, hasPIN, _confirmRemove };
})();

/* ═══════════════════════════════════════════════
   Home OS — autentizace (Supabase Auth)
   ═══════════════════════════════════════════════ */

const Auth = (() => {
  let currentUser = null;

  async function init() {
    try {
      const { data: { session } } = await db.auth.getSession();
      if (session?.user) {
        currentUser = session.user;
        showApp();
      } else {
        showLogin();
      }

      db.auth.onAuthStateChange((_event, session) => {
        currentUser = session?.user ?? null;
        if (currentUser) {
          showApp();
        } else {
          showLogin();
        }
      });
    } catch (err) {
      console.error('Auth init error:', err);
      showLogin();
    }
  }

  async function login(email, password) {
    const { data, error } = await db.auth.signInWithPassword({ email, password });
    if (error) throw error;
    return data;
  }

  async function logout() {
    await db.auth.signOut();
  }

  function showLogin() {
    document.getElementById('loginScreen').style.display = 'flex';
    document.getElementById('app').style.display = 'none';
  }

  function showApp() {
    document.getElementById('loginScreen').style.display = 'none';
    document.getElementById('app').style.display = 'flex';
    // Inicializace UI po přihlášení
    if (typeof App !== 'undefined') App.init(currentUser);
  }

  function getUser() { return currentUser; }

  function getInitials(email) {
    const name = email?.split('@')[0] ?? '';
    return name.slice(0, 2).toUpperCase();
  }

  return { init, login, logout, getUser, getInitials };
})();

/* ── Login form handler ───────────────────────── */
document.addEventListener('DOMContentLoaded', () => {
  const form      = document.getElementById('loginForm');
  const emailEl   = document.getElementById('loginEmail');
  const passEl    = document.getElementById('loginPassword');
  const errEl     = document.getElementById('loginError');
  const submitBtn = document.getElementById('loginSubmit');

  form?.addEventListener('submit', async (e) => {
    e.preventDefault();
    errEl.style.display = 'none';
    submitBtn.disabled = true;
    submitBtn.textContent = 'Přihlašuji…';

    try {
      await Auth.login(emailEl.value.trim(), passEl.value);
    } catch (err) {
      errEl.textContent = err.message === 'Invalid login credentials'
        ? 'Nesprávný e-mail nebo heslo.'
        : err.message;
      errEl.style.display = 'block';
    } finally {
      submitBtn.disabled = false;
      submitBtn.textContent = 'Přihlásit se';
    }
  });

  Auth.init();
});

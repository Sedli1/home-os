/* ════════════════════════════════════════════════
   email.js — AI Email generator + Meeting notes
   ════════════════════════════════════════════════ */

window.EmailModule = (() => {
  'use strict';

  let initialized = false;

  const EMAIL_TYPES = {
    followup: 'Follow-up po schůzce',
    offer: 'Zaslání nabídky',
    reactivation: 'Reaktivace klienta',
    event: 'Pozvánka na akci',
    price_objection: 'Odpověď na cenovou námitku',
    upsell: 'Upsell / Cross-sell',
  };

  const TONE_MAP = {
    professional: 'profesionální',
    formal: 'formální',
    friendly: 'přátelský a neformální',
    urgent: 'naléhavý ale zdvořilý',
  };

  const EMAIL_SYSTEM = `Jsi AI asistent pro Jakuba Sedláčka, B2B Account Managera O2 Czech Republic.
Píšeš profesionální obchodní emaily v češtině. Jakub je zkušený obchodník zaměřený na B2B segment — střední a velké firmy.
O2 Czech Republic je přední telekomunikační operátor nabízející mobilní služby, datová řešení, cloud, IoT a firemní konektivitu.

Pravidla pro emaily:
- Vždy piš v první osobě za Jakuba
- Žádné fráze jako „V případě dotazů neváhejte kontaktovat" — místo toho konkrétní next step
- Zdvořilé, ale sebevědomé — ne servilní
- Délka: 150–250 slov (ne víc, ne míň)
- Vždy konče konkrétní výzvou k akci (CTA)
- Nepodepisuj celé jméno, pouze „Jakub"
- Vrať POUZE validní JSON objekt: {"subject": "...", "body": "..."}`;

  const NOTES_SYSTEM = `Jsi asistent pro strukturování zápisů ze schůzek v B2B prostředí.
Dostaneš surové poznámky z obchodní schůzky a vytvoříš profesionální strukturovaný zápis.

Výstupní formát (použij přesně tuto strukturu):
📋 ZÁPIS ZE SCHŮZKY
Klient: [jméno a firma]
Datum: [datum]

📌 SHRNUTÍ
[2-3 věty popisující hlavní body schůzky]

✅ ZÁVAZKY
• [konkrétní závazek — kdo, co, do kdy]
• ...

⏭️ NEXT STEPS
• [konkrétní krok — kdo, co, do kdy]
• ...

🎯 OBCHODNÍ PŘÍLEŽITOST
[Hodnocení potenciálu a doporučený postup]

Piš v češtině, stručně a jasně.`;

  function init() {
    if (initialized) return;
    initialized = true;

    initTabs();
    setupEmailGen();
    setupMeetingNotes();

    // Set today's date in meeting notes
    const dateEl = document.getElementById('meetingDate');
    if (dateEl) dateEl.value = new Date().toISOString().split('T')[0];
  }

  function initTabs() {
    document.querySelectorAll('[data-tab-group="email"]').forEach(btn => {
      btn.addEventListener('click', () => {
        const target = btn.dataset.target;
        document.querySelectorAll('[data-tab-group="email"]').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        document.querySelectorAll('#tab-email-gen, #tab-meeting-notes').forEach(p => {
          p.classList.remove('active');
          p.classList.add('hidden');
        });
        const pane = document.getElementById(`tab-${target}`);
        if (pane) { pane.classList.remove('hidden'); pane.classList.add('active'); }
      });
    });
  }

  function setupEmailGen() {
    document.getElementById('generateEmailBtn')?.addEventListener('click', generateEmail);
    document.getElementById('copyFullEmailBtn')?.addEventListener('click', copyFullEmail);
    document.getElementById('openMailBtn')?.addEventListener('click', openInMail);
    document.getElementById('copySubjectBtn')?.addEventListener('click', () => {
      App.copyToClipboard(document.getElementById('emailSubjectVal')?.textContent || '');
    });
    document.getElementById('copyBodyBtn')?.addEventListener('click', () => {
      App.copyToClipboard(document.getElementById('emailBodyVal')?.textContent || '');
    });
  }

  async function generateEmail() {
    const type = document.getElementById('emailType')?.value;
    const client = document.getElementById('emailClientName')?.value.trim();
    const company = document.getElementById('emailCompany')?.value.trim();
    const context = document.getElementById('emailContext')?.value.trim();
    const tone = document.getElementById('emailTone')?.value;

    if (!client || !company) {
      App.showToast('Vyplňte jméno klienta a firmu', 'warning');
      return;
    }

    const btn = document.getElementById('generateEmailBtn');
    App.setLoading(btn, true);

    const userMsg = `Napiš email typu: "${EMAIL_TYPES[type] || type}"
Příjemce: ${client} (${company})
Tón: ${TONE_MAP[tone] || tone}
Kontext: ${context || 'Standardní obchodní komunikace'}

Vrať POUZE JSON: {"subject": "...", "body": "..."}`;

    try {
      const result = await App.callAI(EMAIL_SYSTEM, userMsg, { maxTokens: 1024, expectJSON: true });
      showEmailOutput(result.subject || '', result.body || '');
      App.showToast('Email vygenerován', 'success');
    } catch (e) {
      App.showToast(`Chyba: ${e.message}`, 'error');
    } finally {
      App.setLoading(btn, false);
    }
  }

  function showEmailOutput(subject, body) {
    const output = document.getElementById('emailOutput');
    const placeholder = document.getElementById('emailPlaceholder');
    const subjectEl = document.getElementById('emailSubjectVal');
    const bodyEl = document.getElementById('emailBodyVal');

    if (subjectEl) subjectEl.textContent = subject;
    if (bodyEl) bodyEl.textContent = body;
    if (placeholder) placeholder.classList.add('hidden');
    if (output) output.classList.remove('hidden');
  }

  function copyFullEmail() {
    const subject = document.getElementById('emailSubjectVal')?.textContent || '';
    const body = document.getElementById('emailBodyVal')?.textContent || '';
    App.copyToClipboard(`Předmět: ${subject}\n\n${body}`);
  }

  function openInMail() {
    const subject = encodeURIComponent(document.getElementById('emailSubjectVal')?.textContent || '');
    const body = encodeURIComponent(document.getElementById('emailBodyVal')?.textContent || '');
    window.location.href = `mailto:?subject=${subject}&body=${body}`;
  }

  /* ─── Meeting Notes ─── */
  function setupMeetingNotes() {
    document.getElementById('generateNotesBtn')?.addEventListener('click', generateNotes);
    document.getElementById('copyNotesBtn')?.addEventListener('click', copyNotes);
    document.getElementById('exportNotesBtn')?.addEventListener('click', exportNotes);
  }

  async function generateNotes() {
    const client = document.getElementById('meetingClient')?.value.trim();
    const date = document.getElementById('meetingDate')?.value;
    const notes = document.getElementById('meetingNotes')?.value.trim();

    if (!notes) {
      App.showToast('Zadejte poznámky ze schůzky', 'warning');
      return;
    }

    const btn = document.getElementById('generateNotesBtn');
    App.setLoading(btn, true);

    const userMsg = `Klient / firma: ${client || 'Neuvedeno'}
Datum schůzky: ${date ? App.formatDate(date) : 'Neuvedeno'}

Surové poznámky:
${notes}`;

    try {
      const result = await App.callAI(NOTES_SYSTEM, userMsg, { maxTokens: 1500 });
      showNotesOutput(result);
      App.showToast('Zápis strukturován', 'success');
    } catch (e) {
      App.showToast(`Chyba: ${e.message}`, 'error');
    } finally {
      App.setLoading(btn, false);
    }
  }

  function showNotesOutput(text) {
    const output = document.getElementById('notesOutput');
    const placeholder = document.getElementById('notesPlaceholder');
    const formatted = document.getElementById('notesFormatted');
    if (formatted) formatted.textContent = text;
    if (placeholder) placeholder.classList.add('hidden');
    if (output) output.classList.remove('hidden');
  }

  function copyNotes() {
    App.copyToClipboard(document.getElementById('notesFormatted')?.textContent || '');
  }

  function exportNotes() {
    const text = document.getElementById('notesFormatted')?.textContent || '';
    if (!text) { App.showToast('Nejprve vygenerujte zápis', 'warning'); return; }
    const blob = new Blob([text], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `zapis-ze-schuzky-${new Date().toISOString().split('T')[0]}.txt`;
    a.click();
    URL.revokeObjectURL(url);
    App.showToast('Zápis exportován', 'success');
  }

  return { init };
})();

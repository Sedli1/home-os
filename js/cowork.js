/* ═══════════════════════════════════════════════════════
   CLAUDE COWORK PROMPTS MODULE
   Správa a kopírování promptů pro Claude cowork agenta
═══════════════════════════════════════════════════════ */
window.CoworkModule = (() => {
  'use strict';

  let initialized = false;

  function init() {
    if (initialized) return;
    initialized = true;
    setupCopyButtons();
  }

  function setupCopyButtons() {
    document.querySelectorAll('.cowork-copy-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        const promptId = btn.dataset.promptId;
        const bodyEl   = document.getElementById(`cowork-prompt-${promptId}-body`);
        if (!bodyEl) return;

        // Extract plain text from the HTML body
        const text = bodyEl.innerText || bodyEl.textContent || '';
        navigator.clipboard.writeText(text.trim()).then(() => {
          const feedback = document.getElementById(`cowork-copied-${promptId}`);
          if (feedback) {
            feedback.classList.remove('hidden');
            setTimeout(() => feedback.classList.add('hidden'), 2500);
          }
        }).catch(() => {
          // Fallback for older browsers
          const ta = document.createElement('textarea');
          ta.value = text.trim();
          ta.style.position = 'fixed';
          ta.style.opacity  = '0';
          document.body.appendChild(ta);
          ta.select();
          document.execCommand('copy');
          document.body.removeChild(ta);
          const feedback = document.getElementById(`cowork-copied-${promptId}`);
          if (feedback) {
            feedback.classList.remove('hidden');
            setTimeout(() => feedback.classList.add('hidden'), 2500);
          }
        });
      });
    });
  }

  return { init };
})();

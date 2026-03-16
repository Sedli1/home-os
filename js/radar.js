/* ════════════════════════════════════════════════
   radar.js — Sales Radar v3
   ARES přes proxy (bez CORS), reálné zdroje
   ════════════════════════════════════════════════ */

window.RadarModule = (() => {
  'use strict';

  let initialized = false;

  /* ─── Source definitions ─── */
  const SOURCES = [
    {
      id: 'gnews',
      icon: '📰',
      title: 'Google News CZ',
      hint: 'Hledejte: mediální zmínky, tiskové zprávy, kauzy, investice',
      url: (q) => `https://www.google.com/search?q=${encodeURIComponent(q)}&tbm=nws&gl=cz&hl=cs`,
    },
    {
      id: 'linkedin',
      icon: '🔗',
      title: 'LinkedIn — profil firmy',
      hint: 'Hledejte: C-level kontakty, počet zaměstnanců, aktuální dění',
      url: (q) => `https://www.linkedin.com/search/results/companies/?keywords=${encodeURIComponent(q)}`,
    },
    {
      id: 'hn',
      icon: '📊',
      title: 'Hospodářské noviny (HN.cz)',
      hint: 'Hledejte: roční výsledky, investice, akvizice, byznys strategie',
      url: (q) => `https://www.google.com/search?q=site%3Ahn.cz+${encodeURIComponent(q)}`,
    },
    {
      id: 'justice',
      icon: '⚖️',
      title: 'Justice.cz — Sbírka listin',
      hint: 'Hledejte: výpisy z OR, účetní závěrky, dokumenty, změny v vedení',
      url: (q) => `https://or.justice.cz/ias/ui/rejstrik-$firma?nazev=${encodeURIComponent(q)}`,
    },
    {
      id: 'google',
      icon: '🌐',
      title: 'Google — obecné',
      hint: 'Hledejte: web firmy, reference, kontakty, výběrová řízení, PR',
      url: (q) => `https://www.google.com/search?q=${encodeURIComponent(q)}&gl=cz&hl=cs`,
    },
  ];

  /* ─── Init ─── */
  function init() {
    if (initialized) return;
    initialized = true;
    document.getElementById('generateRadarBtn')
      ?.addEventListener('click', runSearch);
    document.getElementById('radarQuery')
      ?.addEventListener('keydown', e => { if (e.key === 'Enter') runSearch(); });
  }

  /* ─── Main search ─── */
  async function runSearch() {
    const queryEl  = document.getElementById('radarQuery');
    const query    = (queryEl?.value || '').trim();
    const resultsEl = document.getElementById('radarResults');
    if (!resultsEl) return;

    if (!query) {
      App.showToast('Zadejte firmu nebo klíčové slovo', 'warning');
      queryEl?.focus();
      return;
    }

    const btn = document.getElementById('generateRadarBtn');
    if (btn) { btn.textContent = '⏳ Hledám...'; btn.disabled = true; }

    // Show ARES card loading immediately + other sources
    resultsEl.innerHTML = `
      <div class="radar-result-row radar-result-row--ares" id="aresCard">
        <div class="radar-result-icon">🏢</div>
        <div class="radar-result-body">
          <div class="radar-result-title">ARES — Obchodní rejstřík</div>
          <div class="radar-result-hint" style="color:var(--text-tertiary)">⏳ Načítám data z ARES...</div>
        </div>
      </div>
      ${SOURCES.map(src => renderLinkCard(src, query)).join('')}`;

    // Fetch ARES in background
    try {
      const aresData = await fetchAres(query);
      const aresCard = document.getElementById('aresCard');
      if (aresCard && aresData) {
        aresCard.outerHTML = renderAresCard(query, aresData);
      } else if (aresCard) {
        aresCard.querySelector('.radar-result-hint').textContent = '⚠️ Firma nenalezena v ARES nebo chyba připojení';
        aresCard.querySelector('.radar-result-hint').style.color = 'var(--danger)';
      }
    } catch (e) {
      const aresCard = document.getElementById('aresCard');
      if (aresCard) {
        aresCard.querySelector('.radar-result-hint').innerHTML =
          `⚠️ ARES nedostupné. <a href="https://ares.gov.cz/ekonomicke-subjekty?q=${encodeURIComponent(query)}" target="_blank" style="color:var(--primary)">Otevřít ARES →</a>`;
        aresCard.querySelector('.radar-result-hint').style.color = 'var(--warning)';
      }
    }

    if (btn) { btn.textContent = '🔍 Vyhledat'; btn.disabled = false; }
    App.showToast(`Výsledky pro: ${query}`, 'success');
  }

  /* ─── ARES proxy fetch ─── */
  async function fetchAres(q) {
    const isIco = /^\d{6,8}$/.test(q);
    const endpoint = isIco
      ? `/api/ares?ico=${encodeURIComponent(q)}`
      : `/api/ares?q=${encodeURIComponent(q)}`;

    const r = await fetch(endpoint, { signal: AbortSignal.timeout(8000) });
    if (!r.ok) throw new Error(`HTTP ${r.status}`);
    const data = await r.json();
    if (data.error) throw new Error(data.error);

    // Normalize response
    if (isIco && data.ico) return { hits: [data] };
    const hits = data.ekonomickeSubjekty || [];
    if (!hits.length) return null;
    return { hits: hits.slice(0, 5) };
  }

  /* ─── ARES result card ─── */
  function renderAresCard(query, aresData) {
    const hits = aresData?.hits || [];
    if (!hits.length) {
      return `<div class="radar-result-row radar-result-row--ares">
        <div class="radar-result-icon">🏢</div>
        <div class="radar-result-body">
          <div class="radar-result-title">ARES — Obchodní rejstřík</div>
          <div class="radar-result-hint">Firma „${App.escHtml(query)}" nebyla nalezena v ARES.</div>
          <a href="https://ares.gov.cz/ekonomicke-subjekty?q=${encodeURIComponent(query)}"
            target="_blank" rel="noopener" class="radar-link-card-btn" style="margin-top:.5rem">
            Zkusit na ARES.gov.cz →</a>
        </div>
      </div>`;
    }

    const hitsHtml = hits.map(h => {
      const name    = App.escHtml(h.obchodniJmeno || h.nazev || '–');
      const ico     = App.escHtml(h.ico || '–');
      const address = App.escHtml(h.sidlo?.textovaAdresa || h.sidlo?.nazevObce || '');
      const status  = h.stavSubjektu || '';
      const legal   = App.escHtml(h.pravniForma?.nazev || '');
      const isActive = ['AKTIVNI', 'Aktivní', 'aktivní'].includes(status);
      const statusHtml = status
        ? `<span style="font-size:11px;font-weight:600;color:${isActive ? 'var(--success)' : 'var(--danger)'}">${isActive ? '● Aktivní' : '● ' + App.escHtml(status)}</span>`
        : '';

      return `<div class="ares-hit">
        <div style="display:flex;gap:.5rem;flex-wrap:wrap;align-items:flex-start">
          <div style="flex:1;min-width:150px">
            <div style="font-weight:600;font-size:13.5px;line-height:1.3">${name}</div>
            <div style="font-size:12px;color:var(--text-secondary);margin-top:.2rem">
              IČO: <strong>${ico}</strong>${address ? ' · ' + address : ''}
            </div>
            ${legal ? `<div style="font-size:11.5px;color:var(--text-tertiary)">${legal}</div>` : ''}
          </div>
          <div style="display:flex;flex-direction:column;gap:.3rem;align-items:flex-end">
            ${statusHtml}
            <div style="display:flex;gap:.3rem;flex-wrap:wrap">
              <a href="https://ares.gov.cz/ekonomicke-subjekty?q=${ico}" target="_blank" rel="noopener"
                class="radar-link-card-btn" style="font-size:11.5px;padding:.3rem .6rem">ARES →</a>
              <a href="https://or.justice.cz/ias/ui/rejstrik-$firma?nazev=${encodeURIComponent(h.obchodniJmeno || query)}"
                target="_blank" rel="noopener" class="radar-link-card-btn"
                style="font-size:11.5px;padding:.3rem .6rem;background:var(--danger)">Justice →</a>
            </div>
          </div>
        </div>
      </div>`;
    }).join('');

    return `<div class="radar-result-row radar-result-row--ares">
      <div class="radar-result-icon">🏢</div>
      <div class="radar-result-body">
        <div class="radar-result-title">ARES — Obchodní rejstřík
          <span style="font-size:11px;font-weight:400;color:var(--text-tertiary);margin-left:.5rem">${hits.length} výsledek/výsledků</span>
        </div>
        <div style="display:flex;flex-direction:column;gap:.4rem;margin-top:.5rem">${hitsHtml}</div>
      </div>
    </div>`;
  }

  /* ─── Standard link card ─── */
  function renderLinkCard(src, query) {
    return `<div class="radar-result-row">
      <div class="radar-result-icon">${src.icon}</div>
      <div class="radar-result-body">
        <div class="radar-result-title">${App.escHtml(src.title)}</div>
        <div class="radar-result-hint">💡 ${App.escHtml(src.hint)}</div>
      </div>
      <div class="radar-result-action">
        <a href="${App.escHtml(src.url(query))}" target="_blank" rel="noopener" class="radar-link-card-btn">
          Otevřít →
        </a>
      </div>
    </div>`;
  }

  return { init };
})();

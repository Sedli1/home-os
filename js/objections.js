/* ════════════════════════════════════════════════
   objections.js — B2B Objection Trainer + Scripts
   ════════════════════════════════════════════════ */

window.ObjectionsModule = (() => {
  'use strict';

  let initialized = false;
  let selectedObjId = null;

  /* ─── Objection Database (16 námitek) ─── */
  const OBJECTIONS = [
    { id: 'price',          icon: '💰', title: 'Je to moc drahé',                        category: 'Cena',          desc: 'Klient říká, že nabídka O2 je mimo jeho rozpočet.' },
    { id: 'happy_current',  icon: '😊', title: 'Jsme spokojeni se stávajícím řešením',   category: 'Spokojenost',   desc: 'Klient je spokojen s aktuálním operátorem nebo interním řešením.' },
    { id: 'bad_timing',     icon: '⏰', title: 'Teď není vhodný čas',                    category: 'Timing',        desc: 'Klient odkládá rozhodnutí na neurčito.' },
    { id: 'need_approval',  icon: '👥', title: 'Musím se poradit s vedením',             category: 'Rozhodovatel',  desc: 'Kontakt nemá pravomoc nebo se schovává za management.' },
    { id: 'competitor',     icon: '⚔️', title: 'Konkurence nám nabídla lepší cenu',      category: 'Konkurence',    desc: 'Klient má levnější nabídku od T-Mobile, Vodafone nebo jiných.' },
    { id: 'no_budget',      icon: '📊', title: 'Nemáme schválený rozpočet',              category: 'Rozpočet',      desc: 'Klient tvrdí, že investici nemá kde vzít.' },
    { id: 'tender',         icon: '📋', title: 'Máme to v tendrování',                   category: 'Proces',        desc: 'Klient je vázán interní procedurou nebo výběrovým řízením.' },
    { id: 'coverage',       icon: '📡', title: 'Vaše pokrytí není dostatečné',           category: 'Technické',     desc: 'Pochybnosti o kvalitě sítě O2 v konkrétním regionu.' },
    { id: 'own_it',         icon: '🖥️', title: 'Máme vlastní IT / interní řešení',      category: 'Technické',     desc: 'Klient má in-house tým nebo proprietární systém.' },
    { id: 'migration',      icon: '🔄', title: 'Nejsme připraveni na migraci',           category: 'Implementace',  desc: 'Klient se bojí komplikací a výpadků při přechodu.' },
    { id: 'contract',       icon: '📝', title: 'Vaše smlouvy jsou příliš rigidní',       category: 'Smluvní',       desc: 'Klient chce větší flexibilitu nebo kratší závazek.' },
    { id: 'send_email',     icon: '📧', title: 'Pošlete mi to emailem',                  category: 'Engagement',    desc: 'Klient odmítá schůzku a chce vše jen emailem.' },
    { id: 'no_interest',    icon: '🚫', title: 'Nemám zájem',                            category: 'Engagement',    desc: 'Paušální odmítnutí bez bližšího zdůvodnění.' },
    { id: 'small_company',  icon: '🏢', title: 'Jsme příliš malá firma pro O2',          category: 'Fit',           desc: 'Klient se domnívá, že O2 cílí jen na korporace.' },
    { id: 'already_called', icon: '📞', title: 'Volali jste mi minulý týden',            category: 'Vztah',         desc: 'Klient je frustrován z opakovaných kontaktů.' },
    { id: 'features',       icon: '⚙️', title: 'Potřebujeme více funkcí / customizaci',  category: 'Produkt',       desc: 'Standardní nabídka klientovi nestačí.' },
  ];

  /* ─── Script Database ─── */
  const SCRIPTS = [
    {
      id: 'cold_call',
      title: '📞 Cold Call Script',
      category: 'Akvizice',
      content: `COLD CALL — B2B Firemní zákazník
────────────────────────────────

OTEVŘENÍ (prvních 10 sekund):
"Dobrý den, [Jméno]. Jmenuji se Jakub Sedláček z O2.
Vím, že váš čas je vzácný — zavolal jsem vám jen na 2 minuty. Smím?"

HOOK (proč volám právě jemu):
"Zjistil jsem, že vaše firma [nedávno rozšiřuje / otevřela pobočku / nabírá IT zaměstnance]
— to mě přivedlo na myšlenku, že byste mohli ocenit, co jsme udělali pro [podobnou firmu]."

DISCOVERY (otevřená otázka):
"Jak nyní řešíte mobilní komunikaci pro váš tým?
Co pro vás v této oblasti funguje — a co bys ideálně změnil?"

VÝZVA K AKCI:
"Bylo by smysluplné se potkat na 20 minut?
Ukážu vám, co konkrétně jsme udělali pro [referenční zákazník] a jestli to pro vás dává smysl — rozhodnutí je samozřejmě na vás."

TIP: Pokud odmítají schůzku → "Rozumím. Co by se muselo stát, abyste to považoval za zajímavé?"`,
    },
    {
      id: 'followup_call',
      title: '🔁 Follow-up po schůzce (telefon)',
      category: 'Follow-up',
      content: `FOLLOW-UP CALL — Po obchodní schůzce
────────────────────────────────────

CÍL: Potvrdit zájem, posunout deal dál

OTEVŘENÍ:
"Dobrý den, [Jméno]. Jakub z O2 — zavolal jsem, jak jsme se domlouvali po naší schůzce.
Máte chvilku?"

RECAP:
"Bavili jsme se o [konkrétní téma / potřeba klienta].
Posílal jsem vám zápis a nabídku — měl jste možnost to projet?"

DISCOVERY OTÁZKY:
- "Co vám z nabídky dávalo největší smysl?"
- "Co by bylo potřeba upřesnit nebo upravit?"
- "Kdo ještě bude do rozhodnutí zapojen?"

NEXT STEP:
"Co říkáte — mohli bychom si dát další schůzku / call příští týden a projednat konkrétní podmínky?
Hodí se vám spíš [den] nebo [den]?"

FALLBACK (pokud stále váhají):
"Naprosto rozumím, že to potřebuje čas. Co je pro vás hlavní otázka, která zbývá zodpovědět?"`,
    },
    {
      id: 'price_nego',
      title: '💰 Cenové vyjednávání',
      category: 'Vyjednávání',
      content: `CENOVÉ VYJEDNÁVÁNÍ — Framework
────────────────────────────────

ZÁSADA: Nikdy neslevujte bez protihodnoty.

KROK 1 — POCHOPTE TLAK:
"Pomoc mi pochopit — je to primárně o ceně za jednotku,
nebo o celkovém TCO za rok? Co přesně srovnáváte?"

KROK 2 — ZJISTĚTE REFERENCI:
"S čím konkrétně srovnáváte naši nabídku?
Vidíte tu nabídku písemně?"

KROK 3 — ZDŮRAZNĚTE HODNOTU:
"Pojďme se podívat na to, co dostanete navíc:
[Zákaznická podpora 24/7, SLA garantovaná, O2 Business Centrum, integrace]
Jak to odpovídá tomu, co máte teď?"

KROK 4 — PODMÍNĚNÁ SLEVA:
"Kdybych pro vás dokázal dosáhnout lepšího čísla,
co byste byl ochoten nabídnout na oplátku?
Delší závazek? Větší objem? Platbu předem?"

KROK 5 — ANCHOR A CLOSE:
"Podívejte — naše standardní cena je X, ale pro vás
bych dokázal vyjednat Y, pokud se rozhodneme do [datum].
To dává smysl?"

NIKDY NEŘÍKEJTE: "To je nejnižší cena, co mohu dát"
— raději: "Tohle je ta nejlepší hodnota, kterou pro vás teď dokážu sestavit."`,
    },
    {
      id: 'discovery',
      title: '🔍 Discovery Script — SPIN',
      category: 'Discovery',
      content: `DISCOVERY PODLE SPIN METODIKY
────────────────────────────────

S — SITUAČNÍ OTÁZKY (pochopte stávající stav):
• "Kolik zaměstnanců aktuálně využívá mobilní nebo datové služby?"
• "Jak jste aktuálně řešeni — máte centrální smlouvu, nebo individuálně?"
• "Kdo u vás komunikaci spravuje — IT oddělení nebo HR?"

P — PROBLÉMOVÉ OTÁZKY (odhalte bolest):
• "Jaké problémy vám aktuální řešení způsobuje?"
• "Stalo se vám, že výpadek komunikace ovlivnil provoz?"
• "Co vám chybí, co by vám výrazně ulehčilo práci?"

I — IMPLIKAČNÍ OTÁZKY (zsilte důsledky):
• "Jak velký dopad má pomalá datová síť na produktivitu vašich obchodníků?"
• "Pokud se to nezmění, co to bude znamenat za rok pro vaši firmu?"
• "Odhadnete, kolik to ročně stojí — v čase nebo přímých nákladech?"

N — NEED-PAYOFF OTÁZKY (klient si sám řekne ANO):
• "Kdybychom dokázali garantovat 99,9% dostupnost — co by to pro vás znamenalo?"
• "Pokud bychom snížili náklady o 15% při stejné kvalitě, jak by to ovlivnilo vaše rozhodování?"
• "Co by se muselo stát, abyste to považoval za skvělou investici?"`,
    },
  ];

  /* ─── Init ─── */
  function init() {
    if (initialized) return;
    initialized = true;

    initTabs();
    renderObjectionsGrid();
    renderScripts();
    setupResponsePanel();
  }

  function initTabs() {
    document.querySelectorAll('[data-tab-group="objections"]').forEach(btn => {
      btn.addEventListener('click', () => {
        document.querySelectorAll('[data-tab-group="objections"]').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        document.querySelectorAll('#tab-obj-trainer, #tab-obj-scripts').forEach(p => {
          p.classList.remove('active');
          p.classList.add('hidden');
        });
        const pane = document.getElementById(`tab-${btn.dataset.target}`);
        if (pane) { pane.classList.remove('hidden'); pane.classList.add('active'); }
      });
    });
  }

  /* ─── Objections Grid ─── */
  function renderObjectionsGrid() {
    const grid = document.getElementById('objectionsGrid');
    if (!grid) return;

    grid.innerHTML = OBJECTIONS.map(obj => `
      <div class="objection-card" data-id="${obj.id}">
        <div class="objection-card-icon">${obj.icon}</div>
        <div class="objection-card-title">${App.escHtml(obj.title)}</div>
        <div class="objection-card-cat">${obj.category}</div>
      </div>`).join('');

    grid.querySelectorAll('.objection-card').forEach(card => {
      card.addEventListener('click', () => selectObjection(card.dataset.id));
    });
  }

  function selectObjection(id) {
    selectedObjId = id;
    const obj = OBJECTIONS.find(o => o.id === id);
    if (!obj) return;

    // Visual active state
    document.querySelectorAll('.objection-card').forEach(c => {
      c.classList.toggle('active', c.dataset.id === id);
    });

    // Show response panel
    const placeholder = document.getElementById('objPlaceholder');
    const responseArea = document.getElementById('objResponseArea');
    const label = document.getElementById('objSelectedLabel');

    if (placeholder) placeholder.classList.add('hidden');
    if (responseArea) responseArea.classList.remove('hidden');
    if (label) label.textContent = `${obj.icon} ${obj.title}`;

    // Reset previous output
    const output = document.getElementById('objResponseOutput');
    if (output) output.classList.add('hidden');
  }

  function setupResponsePanel() {
    document.getElementById('generateObjResponseBtn')?.addEventListener('click', generateObjResponse);
    document.getElementById('copyObjResponseBtn')?.addEventListener('click', () => {
      App.copyToClipboard(document.getElementById('objResponseText')?.textContent || '');
    });
  }

  async function generateObjResponse() {
    if (!selectedObjId) { App.showToast('Vyberte námitku vlevo', 'warning'); return; }
    const obj = OBJECTIONS.find(o => o.id === selectedObjId);
    const context = document.getElementById('objContext')?.value.trim() || '';

    const btn = document.getElementById('generateObjResponseBtn');
    App.setLoading(btn, true);

    const system = `Jsi B2B sales coach pro Jakuba Sedláčka, Account Managera O2 Czech Republic.
Generuješ praktické, přesvědčivé odpovědi na B2B námitky. Jakub prodává firemní telekomunikační služby (mobil, data, cloud, IoT, konektivita).

Struktura odpovědi:
1. UZNAT — Empaticky potvrdit námitku (bez „chápu" nebo „rozumím")
2. PŘEFORMULOVAT — Reframe z jiného pohledu
3. ODPOVĚDĚT — Konkrétní argument s hodnotou pro O2
4. NEXT STEP — Uzavřít otevřenou otázkou

Délka: 180–250 slov. Přirozený hovorový český jazyk, ne korporátní fráze.`;

    const userMsg = `Námitka: "${obj.title}"
Popis situace: ${obj.desc}
Kontext od obchodníka: ${context || 'Standardní B2B firma, bez specifikace'}

Napiš konkrétní, praktickou odpověď na tuto námitku pro Jakuba.`;

    try {
      const text = await App.callAI(system, userMsg, { maxTokens: 800 });
      const output = document.getElementById('objResponseOutput');
      const textEl = document.getElementById('objResponseText');
      if (textEl) textEl.textContent = text;
      if (output) output.classList.remove('hidden');
      App.showToast('Odpověď vygenerována', 'success');
    } catch (e) {
      App.showToast('Chyba: ' + e.message, 'error');
    } finally {
      App.setLoading(btn, false);
    }
  }

  /* ─── Scripts ─── */
  function renderScripts() {
    const container = document.getElementById('scriptsContainer');
    if (!container) return;

    container.innerHTML = SCRIPTS.map(s => `
      <div class="script-card">
        <div class="script-card-header">
          <div class="script-card-title">${App.escHtml(s.title)}</div>
          <div style="display:flex;gap:.5rem;align-items:center">
            <span class="badge badge-gray">${App.escHtml(s.category)}</span>
            <button class="btn btn-sm btn-secondary" onclick="ObjectionsModule._copyScript('${s.id}')">📋</button>
          </div>
        </div>
        <div class="script-card-body" id="script-${s.id}">${App.escHtml(s.content)}</div>
      </div>`).join('');
  }

  function _copyScript(id) {
    const s = SCRIPTS.find(x => x.id === id);
    if (s) App.copyToClipboard(s.content);
  }

  return { init, _copyScript };
})();

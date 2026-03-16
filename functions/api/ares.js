/* ════════════════════════════════════════════════
   api/ares.js — Cloudflare Pages Function: ARES API proxy
   Handles CORS so browser can query Czech business registry
   ════════════════════════════════════════════════ */

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'Content-Type',
  'Access-Control-Allow-Methods': 'GET, OPTIONS',
  'Content-Type': 'application/json',
};

export async function onRequestOptions() {
  return new Response(null, { status: 200, headers: CORS });
}

export async function onRequestGet(context) {
  const { request } = context;
  const url = new URL(request.url);

  const q   = (url.searchParams.get('q')   || '').trim();
  const ico = (url.searchParams.get('ico') || '').trim();

  if (!q && !ico) {
    return new Response(
      JSON.stringify({ error: 'Missing q or ico' }),
      { status: 400, headers: CORS }
    );
  }

  let aresUrl;
  if (ico && /^\d{6,8}$/.test(ico)) {
    aresUrl = `https://ares.gov.cz/ekonomicke-subjekty-v-be/rest/ekonomicke-subjekty/${ico}`;
  } else {
    aresUrl = `https://ares.gov.cz/ekonomicke-subjekty-v-be/rest/ekonomicke-subjekty-res` +
              `?obchodniJmeno=${encodeURIComponent(q)}&pocet=5&razeni=RELEVANCE`;
  }

  try {
    const res = await fetch(aresUrl, {
      headers: { Accept: 'application/json', 'User-Agent': 'O2-Toolkit/1.0' },
      signal: AbortSignal.timeout(6000),
    });

    const text = await res.text();
    let data;
    try { data = JSON.parse(text); } catch { data = { error: 'Invalid JSON from ARES' }; }

    return new Response(JSON.stringify(data), { status: res.status, headers: CORS });

  } catch (err) {
    return new Response(
      JSON.stringify({ error: err.message }),
      { status: 502, headers: CORS }
    );
  }
}

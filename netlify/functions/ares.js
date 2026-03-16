/* ════════════════════════════════════════════════
   ares.js — Netlify Function: ARES API proxy
   Handles CORS so browser can query ARES registry
   ════════════════════════════════════════════════ */

exports.handler = async (event) => {
  const CORS = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Allow-Methods': 'GET, OPTIONS',
    'Content-Type': 'application/json',
  };

  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 200, headers: CORS, body: '' };
  }

  const params = event.queryStringParameters || {};
  const q   = (params.q   || '').trim();
  const ico = (params.ico || '').trim();

  if (!q && !ico) {
    return { statusCode: 400, headers: CORS, body: JSON.stringify({ error: 'Missing q or ico' }) };
  }

  let url;
  if (ico && /^\d{6,8}$/.test(ico)) {
    url = `https://ares.gov.cz/ekonomicke-subjekty-v-be/rest/ekonomicke-subjekty/${ico}`;
  } else {
    url = `https://ares.gov.cz/ekonomicke-subjekty-v-be/rest/ekonomicke-subjekty-res` +
          `?obchodniJmeno=${encodeURIComponent(q)}&pocet=5&razeni=RELEVANCE`;
  }

  try {
    const res = await fetch(url, {
      headers: { Accept: 'application/json', 'User-Agent': 'O2-Toolkit/1.0' },
      signal: AbortSignal.timeout(6000),
    });

    const text = await res.text();
    let data;
    try { data = JSON.parse(text); } catch { data = { error: 'Invalid JSON from ARES' }; }

    return {
      statusCode: res.status,
      headers: CORS,
      body: JSON.stringify(data),
    };
  } catch (err) {
    return {
      statusCode: 502,
      headers: CORS,
      body: JSON.stringify({ error: err.message }),
    };
  }
};

/* ════════════════════════════════════════════════
   ai.js — Netlify Function: Anthropic API proxy
   Uses native fetch (Node 18) — no SDK, no bundling issues
   ════════════════════════════════════════════════ */

exports.handler = async (event) => {
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Content-Type': 'application/json',
  };

  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 200, headers, body: '' };
  }

  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, headers, body: JSON.stringify({ error: 'Method not allowed' }) };
  }

  if (!process.env.ANTHROPIC_API_KEY) {
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ error: 'ANTHROPIC_API_KEY není nastaven. Přidejte ho v Netlify → Site settings → Environment variables.' }),
    };
  }

  let body;
  try {
    body = JSON.parse(event.body);
  } catch {
    return { statusCode: 400, headers, body: JSON.stringify({ error: 'Neplatné JSON tělo požadavku' }) };
  }

  const { systemPrompt, userMessage, maxTokens = 2048 } = body;

  if (!systemPrompt || !userMessage) {
    return { statusCode: 400, headers, body: JSON.stringify({ error: 'Chybí systemPrompt nebo userMessage' }) };
  }

  try {
    // Direct Anthropic REST API call — no SDK required
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'x-api-key': process.env.ANTHROPIC_API_KEY,
        'anthropic-version': '2023-06-01',
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        model: 'claude-sonnet-4-6',
        max_tokens: Math.min(Number(maxTokens) || 2048, 8192),
        system: systemPrompt,
        messages: [{ role: 'user', content: userMessage }],
      }),
    });

    const result = await response.json();

    if (!response.ok) {
      const errMsg = result?.error?.message || `Anthropic API error ${response.status}`;
      return { statusCode: response.status, headers, body: JSON.stringify({ error: errMsg }) };
    }

    const content = result.content?.[0]?.text ?? '';
    return { statusCode: 200, headers, body: JSON.stringify({ content }) };

  } catch (err) {
    console.error('AI function error:', err);
    return { statusCode: 500, headers, body: JSON.stringify({ error: err.message || 'Interní chyba serveru' }) };
  }
};

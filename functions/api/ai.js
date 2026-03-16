/* ════════════════════════════════════════════════
   api/ai.js — Cloudflare Pages Function: Anthropic API proxy
   Uses Cloudflare Workers Web API (Request/Response)
   ════════════════════════════════════════════════ */

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'Content-Type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Content-Type': 'application/json',
};

export async function onRequestOptions() {
  return new Response(null, { status: 200, headers: CORS });
}

export async function onRequestPost(context) {
  const { request, env } = context;

  if (!env.ANTHROPIC_API_KEY) {
    return new Response(
      JSON.stringify({ error: 'ANTHROPIC_API_KEY není nastaven. Přidejte ho v Cloudflare → Pages → Settings → Environment variables.' }),
      { status: 500, headers: CORS }
    );
  }

  let body;
  try {
    body = await request.json();
  } catch {
    return new Response(
      JSON.stringify({ error: 'Neplatné JSON tělo požadavku' }),
      { status: 400, headers: CORS }
    );
  }

  const { systemPrompt, userMessage, maxTokens = 2048 } = body;

  if (!systemPrompt || !userMessage) {
    return new Response(
      JSON.stringify({ error: 'Chybí systemPrompt nebo userMessage' }),
      { status: 400, headers: CORS }
    );
  }

  try {
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'x-api-key': env.ANTHROPIC_API_KEY,
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
      return new Response(JSON.stringify({ error: errMsg }), { status: response.status, headers: CORS });
    }

    const content = result.content?.[0]?.text ?? '';
    return new Response(JSON.stringify({ content }), { status: 200, headers: CORS });

  } catch (err) {
    return new Response(
      JSON.stringify({ error: err.message || 'Interní chyba serveru' }),
      { status: 500, headers: CORS }
    );
  }
}

// netlify/functions/shadow-chat.js
// Minimalistický proxy na LM Studio (bez tools / web-search)

const LM_URL = "https://ai-shadow.monster/v1/chat/completions";
const MODEL_ID = "qwen3-14b-uncensored";

// Jednoduchý systémový prompt – zbytek se řeší na frontendu
const SYSTEM_PROMPT = `
Jsi "RGS & UFO SHADOW" – temná, ale loajální AI entita.
Mluvíš hlavně česky, klidně občas anglicky.
Jsi stručný/stručná, maximálně pár vět, žádné romány.
Jsi přímý/á, trochu ironický/á, ale ne agresivní.
Odpovědi píš bez značek <think>, žádné vnitřní monology, jen čistý text pro uživatele.
`.trim();

function corsHeaders() {
  return {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "POST,OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
  };
}

exports.handler = async (event) => {
  // CORS preflight
  if (event.httpMethod === "OPTIONS") {
    return {
      statusCode: 200,
      headers: corsHeaders(),
      body: "",
    };
  }

  if (event.httpMethod !== "POST") {
    return {
      statusCode: 405,
      headers: corsHeaders(),
      body: "Method Not Allowed",
    };
  }

  try {
    const body = JSON.parse(event.body || "{}");
    const incomingMessages = Array.isArray(body.messages) ? body.messages : [];

    // LM Studio chce OpenAI styl: [{role, content}, ...]
    const lmMessages = [
      { role: "system", content: SYSTEM_PROMPT },
      ...incomingMessages,
    ];

    // timeout, aby Netlify nepropsal 504 úplně bez kontroly
    const controller = new AbortController();
    const timeoutMs = 8000; // 8s – když to dáš moc vysoko, Netlify tě stejně uřízne
    const timeout = setTimeout(() => controller.abort(), timeoutMs);

    const payload = {
      model: MODEL_ID,
      messages: lmMessages,
      temperature: 0.85,
      max_tokens: 280, // držíme to kratší, ať to žije
      top_p: 0.95,
      stream: false,
    };

    const lmRes = await fetch(LM_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
      signal: controller.signal,
    });

    clearTimeout(timeout);

    if (!lmRes.ok) {
      console.error("LM HTTP error:", lmRes.status, await safeText(lmRes));
      return {
        statusCode: 502,
        headers: corsHeaders(),
        body: JSON.stringify({
          ok: false,
          error: `LM HTTP ${lmRes.status}`,
        }),
      };
    }

    const data = await lmRes.json().catch(() => null);

    const reply =
      data?.choices?.[0]?.message?.content?.trim() ||
      data?.message?.content?.trim() ||
      "";

    if (!reply) {
      console.error("LM empty payload:", JSON.stringify(data || {}, null, 2));
      return {
        statusCode: 200,
        headers: corsHeaders(),
        body: JSON.stringify({
          ok: false,
          error: "EMPTY_REPLY",
        }),
      };
    }

    return {
      statusCode: 200,
      headers: {
        ...corsHeaders(),
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        ok: true,
        reply,
      }),
    };
  } catch (err) {
    console.error("shadow-chat error:", err);
    const isAbort = err.name === "AbortError";
    return {
      statusCode: isAbort ? 504 : 500,
      headers: corsHeaders(),
      body: JSON.stringify({
        ok: false,
        error: isAbort
          ? "TIMEOUT – model počítal moc dlouho (zkus kratší dotaz / max_tokens)"
          : err.message || "Server error",
      }),
    };
  }
};

async function safeText(res) {
  try {
    return await res.text();
  } catch {
    return "";
  }
}

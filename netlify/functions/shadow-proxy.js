// netlify/functions/shadow-proxy.js
// Shadow agent proxy: Qwen3 + Serper web search

// Netlify má ve runtime Node 18+, kde je fetch už globálně – žádný import node-fetch

const LM_BASE_URL = process.env.LM_BASE_URL || "https://ai-shadow.monster";
const LM_MODEL = process.env.LM_MODEL || "qwen3-14b-uncensored";
const SERPER_API_KEY = process.env.SERPER_API_KEY;

// jednoduchý helper na JSON odpovědi
function jsonResponse(status, data) {
  return {
    statusCode: status,
    headers: {
      "Content-Type": "application/json",
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Headers": "Content-Type",
      "Access-Control-Allow-Methods": "POST, OPTIONS"
    },
    body: JSON.stringify(data)
  };
}

exports.handler = async (event) => {
  // CORS preflight
  if (event.httpMethod === "OPTIONS") {
    return jsonResponse(200, { ok: true });
  }

  if (event.httpMethod !== "POST") {
    return jsonResponse(405, { error: "Method Not Allowed" });
  }

  let body;
  try {
    body = JSON.parse(event.body || "{}");
  } catch (e) {
    return jsonResponse(400, { error: "Invalid JSON" });
  }

  let messages = Array.isArray(body.messages) ? body.messages : [];
  const temperature = typeof body.temperature === "number" ? body.temperature : 0.9;
  const max_tokens = typeof body.max_tokens === "number" ? body.max_tokens : 900;

  if (!messages.length) {
    return jsonResponse(400, { error: "messages[] required" });
  }

  // --- definice nástroje pro model ---
  const tools = [
    {
      type: "function",
      function: {
        name: "web_search",
        description:
          "Hledej aktuální informace na webu (novinky, hacking, bezpečnost, AI, dark web, analýzy...).",
        parameters: {
          type: "object",
          properties: {
            query: {
              type: "string",
              description: "Co přesně chceš najít (co nejkonkrétnější dotaz)."
            }
          },
          required: ["query"]
        }
      }
    }
  ];

  // === 1. CALL: necháme Qwen3 rozhodnout, jestli použije nástroj ===
  let firstResponse;
  try {
    const lmRes = await fetch(`${LM_BASE_URL}/v1/chat/completions`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
        // tady může být Authorization, pokud ho máš v LM proxy nastavený
        // "Authorization": `Bearer ${process.env.LM_API_KEY}`
      },
      body: JSON.stringify({
        model: LM_MODEL,
        messages,
        temperature,
        max_tokens,
        tools,
        tool_choice: "auto"
      })
    });

    if (!lmRes.ok) {
      const text = await lmRes.text().catch(() => "");
      return jsonResponse(lmRes.status, {
        error: "LM request failed",
        details: text
      });
    }

    firstResponse = await lmRes.json();
  } catch (e) {
    console.error("LM first call error:", e);
    return jsonResponse(500, { error: "LM connection error" });
  }

  const choice = firstResponse.choices?.[0];
  if (!choice || !choice.message) {
    return jsonResponse(500, { error: "LM returned empty response" });
  }

  const msg = choice.message;
  const toolCalls = msg.tool_calls || [];

  // žádný tool → rovnou vracíme text do frontendu
  if (!toolCalls.length) {
    const content = msg.content || "";
    if (!content || !content.trim()) {
      // nic nepřišlo – aspoň nějaký fallback
      return jsonResponse(200, {
        choices: [
          {
            message: {
              role: "assistant",
              content: "Model něco spočítal, ale ven nepadlo nic použitelného. Zkus otázku přeformulovat nebo být konkrétnější."
            }
          }
        ]
      });
    }

    return jsonResponse(200, firstResponse);
  }

  // === 2. PROVEDENÍ TOOLŮ ===
  const toolMessages = [];

  for (const tc of toolCalls) {
    if (!tc.function || !tc.function.name) continue;

    const toolName = tc.function.name;
    let args = {};
    try {
      args = tc.function.arguments ? JSON.parse(tc.function.arguments) : {};
    } catch (e) {
      console.error("Tool args parse error:", e);
    }

    if (toolName === "web_search") {
      const query = (args.query || "").toString().trim();
      if (!SERPER_API_KEY) {
        toolMessages.push({
          role: "tool",
          tool_call_id: tc.id,
          name: toolName,
          content: JSON.stringify({
            ok: false,
            error: "SERPER_API_KEY is missing on server"
          })
        });
      } else if (!query) {
        toolMessages.push({
          role: "tool",
          tool_call_id: tc.id,
          name: toolName,
          content: JSON.stringify({
            ok: false,
            error: "Missing query for web_search"
          })
        });
      } else {
        // reálný web search přes Serper
        try {
          const sRes = await fetch("https://google.serper.dev/search", {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              "X-API-KEY": SERPER_API_KEY
            },
            body: JSON.stringify({
              q: query,
              num: 5
            })
          });

          if (!sRes.ok) {
            const text = await sRes.text().catch(() => "");
            toolMessages.push({
              role: "tool",
              tool_call_id: tc.id,
              name: toolName,
              content: JSON.stringify({
                ok: false,
                error: "Serper HTTP " + sRes.status,
                details: text.slice(0, 500)
              })
            });
          } else {
            const sJson = await sRes.json();
            // zabalíme jen to podstatné, ať to není megadlouhé
            toolMessages.push({
              role: "tool",
              tool_call_id: tc.id,
              name: toolName,
              content: JSON.stringify({
                ok: true,
                query,
                organic: (sJson.organic || []).slice(0, 5),
                news: (sJson.news || []).slice(0, 5)
              })
            });
          }
        } catch (e) {
          console.error("Serper error:", e);
          toolMessages.push({
            role: "tool",
            tool_call_id: tc.id,
            name: toolName,
            content: JSON.stringify({
              ok: false,
              error: "Serper fetch failed"
            })
          });
        }
      }
    } else {
      // neznámý tool (do budoucna)
      toolMessages.push({
        role: "tool",
        tool_call_id: tc.id,
        name: toolName,
        content: JSON.stringify({
          ok: false,
          error: `Tool ${toolName} není na backendu implementovaný.`
        })
      });
    }
  }

  // === 3. SECOND CALL: pošleme modelu výsledky nástrojů ===
  const extendedMessages = [
    ...messages,
    {
      role: "assistant",
      content: msg.content || null,
      tool_calls: toolCalls
    },
    ...toolMessages
  ];

  let finalResponse;
  try {
    const lmRes2 = await fetch(`${LM_BASE_URL}/v1/chat/completions`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        model: LM_MODEL,
        messages: extendedMessages,
        temperature,
        max_tokens,
        // teď už nechceme další tool-cally, jen finální text
        tool_choice: "none"
      })
    });

    if (!lmRes2.ok) {
      const text = await lmRes2.text().catch(() => "");
      return jsonResponse(lmRes2.status, {
        error: "LM second request failed",
        details: text
      });
    }

    finalResponse = await lmRes2.json();
  } catch (e) {
    console.error("LM second call error:", e);
    return jsonResponse(500, { error: "LM second call error" });
  }

  return jsonResponse(200, finalResponse);
};

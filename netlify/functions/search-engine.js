// netlify/functions/search-engine.js
// Serper.dev web search proxy pro SHADOW
// CommonJS, bez node-fetch, kompatibilní s Netlify Functions

const SERPER_API_KEY = process.env.SERPER_API_KEY;

function cors(statusCode, bodyObj) {
  return {
    statusCode,
    headers: {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "POST, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type, Authorization",
    },
    body: bodyObj ? JSON.stringify(bodyObj) : "",
  };
}

exports.handler = async (event) => {
  // CORS preflight
  if (event.httpMethod === "OPTIONS") {
    return cors(200);
  }

  if (event.httpMethod !== "POST") {
    return cors(405, { ok: false, error: "Method Not Allowed" });
  }

  if (!SERPER_API_KEY) {
    return cors(500, { ok: false, error: "Missing SERPER_API_KEY env var" });
  }

  try {
    let body = {};
    try {
      body = JSON.parse(event.body || "{}");
    } catch {
      return cors(400, { ok: false, error: "Invalid JSON body" });
    }

    const query = (body.query || body.q || "").trim();
    if (!query) {
      return cors(400, { ok: false, error: "Missing 'query' field" });
    }

    const res = await fetch("https://google.serper.dev/search", {
      method: "POST",
      headers: {
        "X-API-KEY": SERPER_API_KEY,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        q: query,
        num: 8,
        gl: "cz",
        hl: "cs",
        autocorrect: true,
      }),
    });

    if (!res.ok) {
      const text = await res.text().catch(() => "");
      return cors(502, {
        ok: false,
        error: "Serper error",
        status: res.status,
        body: text.slice(0, 500),
      });
    }

    const data = await res.json();

    const organic = Array.isArray(data.organic) ? data.organic : [];
    const news = Array.isArray(data.news) ? data.news : [];

    const normalize = (item) => ({
      title: item.title || "",
      url: item.link || item.url || "",
      snippet: item.snippet || item.description || "",
      date: item.date || item.datePublished || null,
      source: item.source || null,
    });

    const results = [
      ...organic.map(normalize),
      ...news.map(normalize),
    ].slice(0, 12);

    return cors(200, {
      ok: true,
      query,
      results,
      meta: {
        organicCount: organic.length,
        newsCount: news.length,
      },
    });
  } catch (err) {
    console.error("search-engine error:", err);
    return cors(500, {
      ok: false,
      error: "search-engine exception",
      message: err && err.message ? err.message : String(err),
    });
  }
};

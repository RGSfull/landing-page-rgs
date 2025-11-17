// netlify/functions/search-engine.js
// Shadow Search Engine → externí vyhledávání + stažení textu ze stránek

// POZOR: Potřebuješ mít v Netlify nastavenou proměnnou prostředí
// SERPER_API_KEY (nebo si to přepiš na jiný search API).

export async function handler(event) {
  try {
    if (event.httpMethod !== "POST") {
      return { statusCode: 405, body: "Method Not Allowed" };
    }

    const SERPER_KEY = process.env.SERPER_API_KEY;
    if (!SERPER_KEY) {
      return {
        statusCode: 500,
        body: JSON.stringify({ ok: false, error: "Missing SERPER_API_KEY" })
      };
    }

    const body = JSON.parse(event.body || "{}");
    const query = (body.query || "").trim();

    if (!query) {
      return {
        statusCode: 400,
        body: JSON.stringify({ ok: false, error: "Missing query" })
      };
    }

    // 1) zavoláme Serper (Google-like search)
    const searchRes = await fetch("https://google.serper.dev/search", {
      method: "POST",
      headers: {
        "X-API-KEY": SERPER_KEY,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        q: query,
        num: 5,
        autocorrect: true
      })
    });

    if (!searchRes.ok) {
      const text = await searchRes.text();
      console.error("Serper error:", searchRes.status, text);
      return {
        statusCode: 502,
        body: JSON.stringify({
          ok: false,
          error: `Search upstream error: ${searchRes.status}`
        })
      };
    }

    const searchData = await searchRes.json();
    const results = searchData.organic || [];

    // 2) stáhneme top 3 výsledky a oholíme HTML na text
    const pages = [];
    for (const r of results.slice(0, 3)) {
      try {
        const resp = await fetch(r.link, { method: "GET" });
        if (!resp.ok) continue;
        const html = await resp.text();
        // jednoduché odstranění HTML tagů
        const text = html
          .replace(/<script[\s\S]*?<\/script>/gi, " ")
          .replace(/<style[\s\S]*?<\/style>/gi, " ")
          .replace(/<[^>]+>/g, " ")
          .replace(/\s+/g, " ")
          .trim();
        pages.push({
          title: r.title || "",
          url: r.link,
          snippet: r.snippet || "",
          text: text.slice(0, 8000)
        });
      } catch (e) {
        console.error("Fetch page error:", r.link, e);
      }
    }

    return {
      statusCode: 200,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        ok: true,
        query,
        results,
        pages
      })
    };
  } catch (err) {
    console.error("search-engine error:", err);
    return { statusCode: 500, body: JSON.stringify({ ok: false, error: "Server error" }) };
  }
}

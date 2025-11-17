// netlify/functions/search-engine.js
// Shadow Search Engine → external search + fetch website contents

import fetch from "node-fetch";

const SERPER_KEY = process.env.SERPER_API_KEY;

export async function handler(event) {
  try {
    if (event.httpMethod !== "POST") {
      return { statusCode: 405, body: "Method Not Allowed" };
    }

    if (!SERPER_KEY) {
      return { statusCode: 500, body: "Missing SERPER_API_KEY" };
    }

    const body = JSON.parse(event.body || "{}");
    const query = (body.query || "").trim();

    if (!query) {
      return {
        statusCode: 400,
        body: JSON.stringify({ ok: false, error: "Missing query" })
      };
    }

    // 1) SEARCH
    const res = await fetch("https://google.serper.dev/search", {
      method: "POST",
      headers: {
        "X-API-KEY": SERPER_KEY,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({ q: query, num: 5 })
    });

    const searchData = await res.json();
    const results = searchData.organic || [];

    // 2) FETCH TOP RESULTS
    const pages = [];
    for (const r of results.slice(0, 3)) {
      try {
        const html = await fetch(r.link).then(r => r.text());
        const clean = html.replace(/<[^>]*>/g, " ").replace(/\s+/g, " ");
        pages.push({
          title: r.title,
          url: r.link,
          snippet: r.snippet,
          text: clean.slice(0, 5000)
        });
      } catch {}
    }

    return {
      statusCode: 200,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ok: true, results, pages })
    };

  } catch (err) {
    console.error(err);
    return { statusCode: 500, body: "Server error" };
  }
}

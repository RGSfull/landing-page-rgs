// netlify/functions/web-search.js
// Shadow Web Recon Agent – multi-scrape crawler (max depth 3)

import fetch from "node-fetch";
import { JSDOM } from "jsdom";

export async function handler(event) {
  try {
    if (event.httpMethod !== "POST") {
      return { statusCode: 405, body: "Method Not Allowed" };
    }

    const body = JSON.parse(event.body || "{}");
    const url = (body.url || "").trim();
    const depth = Math.min(body.depth || 2, 5);

    if (!url) {
      return {
        statusCode: 400,
        body: JSON.stringify({ ok: false, error: "Missing URL" })
      };
    }

    const visited = new Set();
    const results = [];

    async function scrape(targetUrl, level = 0) {
      if (level > depth) return;
      if (visited.has(targetUrl)) return;

      visited.add(targetUrl);

      try {
        const res = await fetch(targetUrl, { timeout: 8000 });
        const html = await res.text();
        const dom = new JSDOM(html);
        const doc = dom.window.document;

        const text = doc.body.textContent
          .replace(/\s+/g, " ")
          .trim()
          .slice(0, 5000);

        results.push({ url: targetUrl, text });

        // follow links from same domain
        const links = [...doc.querySelectorAll("a")]
          .map(a => a.href)
          .filter(href => href && href.startsWith(url.split("/")[2]))
          .slice(0, 5);

        for (const link of links) {
          await scrape(link, level + 1);
        }

      } catch (err) {
        console.error("SCRAPER ERROR:", err);
      }
    }

    await scrape(url, 0);

    return {
      statusCode: 200,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        ok: true,
        scanned: results.length,
        pages: results
      })
    };

  } catch (err) {
    console.error("web-search error:", err);
    return { statusCode: 500, body: "Server error" };
  }
}

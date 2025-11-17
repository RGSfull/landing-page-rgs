// netlify/functions/web-search.js
// Shadow Web Recon Agent – jednoduchý multi-scrape (maxDepth = 3)

export async function handler(event) {
  try {
    if (event.method === "OPTIONS" || event.httpMethod === "OPTIONS") {
      return {
        statusCode: 204,
        headers: {
          "Access-Control-Allow-Origin": "*",
          "Access-Control-Allow-Methods": "POST, OPTIONS",
          "Access-Control-Allow-Headers": "Content-Type"
        }
      };
    }

    if (event.httpMethod !== "POST") {
      return { statusCode: 405, body: "Method Not Allowed" };
    }

    const body = JSON.parse(event.body || "{}");
    let url = (body.url || "").trim();
    let depth = typeof body.depth === "number" ? body.depth : 2;
    if (!url) {
      return {
        statusCode: 400,
        body: JSON.stringify({ ok: false, error: "Missing url" })
      };
    }

    // pokud někdo napíše jen "rgs-ufo.com", přidej https://
    if (!/^https?:\/\//i.test(url)) {
      url = "https://" + url;
    }

    depth = Math.min(depth, 3);

    const visited = new Set();
    const pages = [];
    const origin = new URL(url).origin;

    async function crawl(targetUrl, level):

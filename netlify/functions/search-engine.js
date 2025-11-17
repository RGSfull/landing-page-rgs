// netlify/functions/search-engine.js
// CommonJS verze – žádné "export", jen exports.handler

const fetch = require("node-fetch");

const SERPER_API_KEY = process.env.SERPER_API_KEY;

exports.handler = async (event) => {
  try {
    if (event.httpMethod !== "GET") {
      return {
        statusCode: 405,
        body: "Method Not Allowed",
      };
    }

    if (!SERPER_API_KEY) {
      console.error("Missing SERPER_API_KEY env");
      return {
        statusCode: 500,
        body: JSON.stringify({ ok: false, error: "Server misconfigured" }),
      };
    }

    const params = new URLSearchParams(event.rawQuery || event.queryStringParameters || "");
    const q = (params.get ? params.get("q") : params.q) || "";

    if (!q.trim()) {
      return {
        statusCode: 400,
        body: JSON.stringify({ ok: false, error: "Missing q" }),
      };
    }

    // volání Serper API
    const serperRes = await fetch("https://google.serper.dev/search", {
      method: "POST",
      headers: {
        "X-API-KEY": SERPER_API_KEY,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        q,
        num: 6,
        gl: "us",
        hl: "en",
      }),
    });

    if (!serperRes.ok) {
      const txt = await serperRes.text().catch(() => "");
      console.error("Serper error:", serperRes.status, txt);
      return {
        statusCode: 500,
        body: JSON.stringify({ ok: false, error: "Serper error" }),
      };
    }

    const data = await serperRes.json();

    const hits = [];

    if (Array.isArray(data.organic)) {
      for (const item of data.organic.slice(0, 6)) {
        hits.push({
          title: item.title || "",
          url: item.link || "",
          snippet: item.snippet || "",
          source: item.source || "",
        });
      }
    }

    return {
      statusCode: 200,
      headers: {
        "Content-Type": "application/json",
        "Access-Control-Allow-Origin": "*",
      },
      body: JSON.stringify({
        ok: true,
        query: q,
        results: hits,
      }),
    };
  } catch (err) {
    console.error("search-engine error:", err);
    return {
      statusCode: 500,
      body: JSON.stringify({ ok: false, error: "Server error" }),
    };
  }
};

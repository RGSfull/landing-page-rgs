// netlify/functions/search-engine.js
// Simple Serper.dev proxy – LM tools: web_search("query")

const fetch = require("node-fetch"); // musíš mít v package.json dependency "node-fetch"

const API_KEY = process.env.SERPER_API_KEY;

exports.handler = async (event) => {
  // CORS pro browser i LM server
  if (event.httpMethod === "OPTIONS") {
    return {
      statusCode: 204,
      headers: {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Methods": "GET,POST,OPTIONS",
        "Access-Control-Allow-Headers": "Content-Type,Authorization",
      },
      body: "",
    };
  }

  if (!API_KEY) {
    return {
      statusCode: 500,
      headers: { "Access-Control-Allow-Origin": "*" },
      body: JSON.stringify({ ok: false, error: "Missing SERPER_API_KEY" }),
    };
  }

  let query = "";

  try {
    if (event.httpMethod === "POST" && event.body) {
      const body = JSON.parse(event.body || "{}");
      query = (body.q || body.query || "").toString().trim();
    } else {
      // fallback pro GET / tools, co posílají query v URL
      const qs = event.queryStringParameters || {};
      query = (qs.q || qs.query || "").toString().trim();
    }
  } catch {
    query = "";
  }

  if (!query) {
    return {
      statusCode: 400,
      headers: { "Access-Control-Allow-Origin": "*" },
      body: JSON.stringify({ ok: false, error: "Missing query" }),
    };
  }

  try {
    const res = await fetch("https://google.serper.dev/search", {
      method: "POST",
      headers: {
        "X-API-KEY": API_KEY,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        q: query,
        num: 5,
        gl: "us",
        hl: "en",
      }),
    });

    const json = await res.json();

    const items = [];
    const organic = json.organic || [];
    for (const item of organic.slice(0, 5)) {
      items.push({
        title: item.title,
        url: item.link,
        snippet: item.snippet,
      });
    }

    return {
      statusCode: 200,
      headers: {
        "Access-Control-Allow-Origin": "*",
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        ok: true,
        query,
        results: items,
      }),
    };
  } catch (err) {
    console.error("search-engine error:", err);
    return {
      statusCode: 500,
      headers: { "Access-Control-Allow-Origin": "*" },
      body: JSON.stringify({ ok: false, error: "Search failed" }),
    };
  }
};

// netlify/functions/note-create.js
// Vytvoření burn-note: uloží cipher+iv pod jednorázový token a vrátí token.

const crypto = require("crypto");

const REDIS_URL = process.env.UPSTASH_REDIS_REST_URL;
const REDIS_TOKEN = process.env.UPSTASH_REDIS_REST_TOKEN;
const TTL_SECONDS = 60 * 60 * 24; // 24h životnost

exports.handler = async (event) => {
  if (event.httpMethod !== "POST") {
    return { statusCode: 405, body: "Method Not Allowed" };
  }

  if (!REDIS_URL || !REDIS_TOKEN) {
    return { statusCode: 500, body: "Missing Redis config" };
  }

  try {
    const body = JSON.parse(event.body || "{}");
    const { cipher, iv } = body;

    if (!cipher || !iv) {
      return { statusCode: 400, body: "Missing cipher/iv" };
    }

    // token = random, bez pomlček
    const token = crypto.randomUUID().replace(/-/g, "");

    const payload = JSON.stringify({ cipher, iv });

    // Upstash Redis REST: SETEX token TTL value
    const url = `${REDIS_URL}/setex/${token}/${TTL_SECONDS}/${encodeURIComponent(
      payload
    )}`;

    const res = await fetch(url, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${REDIS_TOKEN}`,
      },
    });

    if (!res.ok) {
      const text = await res.text();
      return {
        statusCode: 500,
        body: `Redis error: ${res.status} ${text}`,
      };
    }

    return {
      statusCode: 200,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ token }),
    };
  } catch (err) {
    return {
      statusCode: 500,
      body: "Server error: " + (err && err.message ? err.message : String(err)),
    };
  }
};
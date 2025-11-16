// netlify/functions/note-create.js
// Burn Lane v2 – vytvoření zprávy (cipher+iv uložené v Redis, metadata v Neon)

import { Client } from "pg";
import crypto from "crypto";

const redisUrl = process.env.UPSTASH_REDIS_REST_URL;
const redisToken = process.env.UPSTASH_REDIS_REST_TOKEN;
const connectionString =
  process.env.DATABASE_URL || process.env.NETLIFY_DATABASE_URL;

export async function handler(event) {
  try {
    if (event.httpMethod !== "POST") {
      return { statusCode: 405, body: "Method Not Allowed" };
    }

    if (!redisUrl || !redisToken || !connectionString) {
      console.error("Missing Redis/DB env");
      return { statusCode: 500, body: "Server misconfigured" };
    }

    const body = JSON.parse(event.body || "{}");
    const cipher = (body.cipher || "").trim();
    const iv = (body.iv || "").trim();
    let ttlHours = parseInt(body.ttlHours, 10);
    let slugRaw = (body.slug || "").trim();

    if (!cipher || !iv) {
      return { statusCode: 400, body: "Missing cipher or iv" };
    }

    if (isNaN(ttlHours)) ttlHours = 24;
    ttlHours = Math.min(Math.max(ttlHours, 1), 24);
    const ttlSeconds = ttlHours * 3600;

    if (!slugRaw) {
      slugRaw =
        "note-" +
        Math.random()
          .toString(36)
          .slice(2, 8);
    }

    const token = crypto.randomUUID().replace(/-/g, "");

    // Redis: setex token ttl payload
    const payload = encodeURIComponent(JSON.stringify({ cipher, iv }));
    const redisRes = await fetch(
      `${redisUrl}/setex/${token}/${ttlSeconds}/${payload}`,
      {
        method: "GET",
        headers: {
          Authorization: `Bearer ${redisToken}`
        }
      }
    );

    if (!redisRes.ok) {
      console.error("Redis SETEX failed:", await redisRes.text());
      return { statusCode: 500, body: "Redis error" };
    }

    // Neon: ulož meta info
    const client = new Client({ connectionString });
    await client.connect();

    await client.query(
      `INSERT INTO burn_notes (token, slug, ttl_hours)
       VALUES ($1,$2,$3)`,
      [token, slugRaw, ttlHours]
    );

    await client.end();

    return {
      statusCode: 200,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        ok: true,
        token,
        slug: slugRaw,
        ttl_hours: ttlHours
      })
    };
  } catch (err) {
    console.error("note-create error:", err);
    return { statusCode: 500, body: "Server error" };
  }
}

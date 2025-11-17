// netlify/functions/note-read.js
// Burn Lane v2 – jednorázové přečtení, smazání z Redis, burned_at v Neon

import { Client } from "pg";

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
    const token = (body.token || "").trim();

    if (!token) {
      return { statusCode: 400, body: "Missing token" };
    }

    // Redis GET
    const getRes = await fetch(`${redisUrl}/get/${token}`, {
      method: "GET",
      headers: { Authorization: `Bearer ${redisToken}` }
    });

    if (!getRes.ok) {
      console.error("Redis GET failed:", await getRes.text());
      return { statusCode: 500, body: "Redis error" };
    }

  const json = await getRes.json();
  console.log("note-read token:", token);
  console.log("Redis GET json:", JSON.stringify(json));
  const result = json.result;

    if (result === null) {
      // note není v Redis – buď expirovala, nebo už byla přečtená
      return { statusCode: 410, body: "Gone" };
    }

    // Burn = delete from Redis
    fetch(`${redisUrl}/del/${token}`, {
      method: "GET",
      headers: { Authorization: `Bearer ${redisToken}` }
    }).catch(() => {});

    let payload;
    try {
      payload = JSON.parse(decodeURIComponent(result));
    } catch (e) {
      console.error("Payload parse error:", e);
      return { statusCode: 500, body: "Payload error" };
    }

    // Update burned_at v Neon
    const client = new Client({ connectionString });
    await client.connect();

    await client.query(
      `UPDATE burn_notes
       SET burned_at = now()
       WHERE token = $1 AND burned_at IS NULL`,
      [token]
    );

    await client.end();

    return {
      statusCode: 200,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        ok: true,
        cipher: payload.cipher,
        iv: payload.iv
      })
    };
  } catch (err) {
    console.error("note-read error:", err);
    return { statusCode: 500, body: "Server error" };
  }
}

// netlify/functions/thread-create.js
// Burn v3 – vytvoření vlákna (bez plaintextu, jen meta v Neon)

import { Client } from "pg";
import crypto from "crypto";

const connectionString =
  process.env.DATABASE_URL || process.env.NETLIFY_DATABASE_URL;

export async function handler(event) {
  try {
    if (event.httpMethod !== "POST") {
      return { statusCode: 405, body: "Method Not Allowed" };
    }

    if (!connectionString) {
      console.error("Missing DB connection string");
      return { statusCode: 500, body: "Server misconfigured" };
    }

    const client = new Client({ connectionString });
    await client.connect();

    const token = crypto.randomUUID().replace(/-/g, "");

    // 1h TTL od vytvoření
    const res = await client.query(
      `
      INSERT INTO burn_threads (token, expires_at)
      VALUES ($1, now() + interval '1 hour')
      RETURNING id, created_at, expires_at
    `,
      [token]
    );

    await client.end();

    const row = res.rows[0];

    return {
      statusCode: 200,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        ok: true,
        token,
        created_at: row.created_at,
        expires_at: row.expires_at
      })
    };
  } catch (err) {
    console.error("thread-create error:", err);
    return { statusCode: 500, body: "Server error" };
  }
}

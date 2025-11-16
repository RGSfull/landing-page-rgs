// netlify/functions/thread-post.js
// Burn v3 – přidání šifrované zprávy do vlákna

import { Client } from "pg";

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

    const body = JSON.parse(event.body || "{}");
    const token = (body.token || "").trim();
    const cipher = (body.cipher || "").trim();
    const iv = (body.iv || "").trim();

    if (!token || !cipher || !iv) {
      return { statusCode: 400, body: "Missing token/cipher/iv" };
    }

    const client = new Client({ connectionString });
    await client.connect();

    // Najdi vlákno a ověř TTL
    const threadRes = await client.query(
      `
      SELECT id, expires_at, closed_at
      FROM burn_threads
      WHERE token = $1
    `,
      [token]
    );

    if (threadRes.rowCount === 0) {
      await client.end();
      return { statusCode: 410, body: "Thread not found" };
    }

    const thread = threadRes.rows[0];

    if (thread.closed_at || new Date(thread.expires_at) < new Date()) {
      await client.end();
      return { statusCode: 410, body: "Thread expired" };
    }

    await client.query(
      `
      INSERT INTO burn_thread_messages (thread_id, cipher, iv)
      VALUES ($1, $2, $3)
    `,
      [thread.id, cipher, iv]
    );

    await client.end();

    return {
      statusCode: 200,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ok: true })
    };
  } catch (err) {
    console.error("thread-post error:", err);
    return { statusCode: 500, body: "Server error" };
  }
}

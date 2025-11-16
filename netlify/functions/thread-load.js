// netlify/functions/thread-load.js
// Burn v3 – načtení vlákna + šifrovaných zpráv

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

    if (!token) {
      return { statusCode: 400, body: "Missing token" };
    }

    const client = new Client({ connectionString });
    await client.connect();

    const threadRes = await client.query(
      `
      SELECT id, created_at, expires_at, closed_at
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

    const now = new Date();
    const expired = thread.closed_at || new Date(thread.expires_at) < now;

    if (expired) {
      await client.end();
      return {
        statusCode: 410,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ok: false,
          reason: "expired",
          created_at: thread.created_at,
          expires_at: thread.expires_at
        })
      };
    }

    const msgRes = await client.query(
      `
      SELECT id, created_at, cipher, iv
      FROM burn_thread_messages
      WHERE thread_id = $1
      ORDER BY created_at ASC
    `,
      [thread.id]
    );

    await client.end();

    return {
      statusCode: 200,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        ok: true,
        thread: {
          created_at: thread.created_at,
          expires_at: thread.expires_at
        },
        messages: msgRes.rows
      })
    };
  } catch (err) {
    console.error("thread-load error:", err);
    return { statusCode: 500, body: "Server error" };
  }
}

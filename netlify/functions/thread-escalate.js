// netlify/functions/thread-escalate.js
// Burn v3 – eskalace vlákna (flag v DB + uzavření)

import { Client } from "pg";

const connectionString =
  process.env.DATABASE_URL || process.env.NETLIFY_DATABASE_URL;

export async function handler(event) {
  try {
    if (event.httpMethod !== "POST") {
      return { statusCode: 405, body: "Method Not Allowed" };
    }

    if (!connectionString) {
      console.error("Missing DB env");
      return { statusCode: 500, body: "Server misconfigured" };
    }

    const body = JSON.parse(event.body || "{}");
    const token = (body.token || "").trim();

    if (!token) {
      return { statusCode: 400, body: "Missing token" };
    }

    const client = new Client({ connectionString });
    await client.connect();

    const res = await client.query(
      `
      UPDATE burn_threads
      SET escalated = true,
          closed_at = COALESCE(closed_at, now())
      WHERE token = $1
      RETURNING id, created_at, expires_at, escalated
      `,
      [token]
    );

    await client.end();

    if (res.rowCount === 0) {
      return {
        statusCode: 404,
        body: JSON.stringify({ ok: false, error: "Thread not found" })
      };
    }

    return {
      statusCode: 200,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ok: true, thread: res.rows[0] })
    };
  } catch (err) {
    console.error("thread-escalate error:", err);
    return {
      statusCode: 500,
      body: JSON.stringify({ ok: false, error: "Server error" })
    };
  }
}

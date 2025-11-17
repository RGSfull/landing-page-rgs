// netlify/functions/burn-threads-admin.js
// Admin panel pro Burn Lane v3 – seznam vláken + statistiky

import { Client } from "pg";

// tajný klíč – musí sedět s Netlify env RGS_ADMIN_KEY
const ADMIN_KEY = process.env.RGS_ADMIN_KEY;

// Neon DB URL
const connectionString =
  process.env.DATABASE_URL || process.env.NETLIFY_DATABASE_URL;

export async function handler(event) {
  try {
    // pouze GET
    if (event.httpMethod !== "GET") {
      return {
        statusCode: 405,
        body: "Method Not Allowed"
      };
    }

    // získat ?key=
    const key = event.queryStringParameters?.key || "";

    if (!ADMIN_KEY || key.trim() !== ADMIN_KEY.trim()) {
      return {
        statusCode: 401,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ok: false,
          error: "Unauthorized"
        })
      };
    }

    if (!connectionString) {
      return {
        statusCode: 500,
        body: JSON.stringify({
          ok: false,
          error: "Missing DB connection string"
        })
      };
    }

    // připojit DB
    const client = new Client({ connectionString });
    await client.connect();

    // list threads
    const qThreads = await client.query(`
      SELECT 
        id,
        token,
        created_at,
        expires_at,
        closed_at
      FROM burn_threads
      ORDER BY created_at DESC
      LIMIT 100
    `);

    // stats threads
    const qStats = await client.query(`
      SELECT
        COUNT(*) AS total,
        COUNT(*) FILTER (WHERE expires_at > now() AND closed_at IS NULL) AS active,
        COUNT(*) FILTER (WHERE expires_at <= now()) AS expired,
        COUNT(*) FILTER (WHERE closed_at IS NOT NULL) AS closed
      FROM burn_threads
    `);

    await client.end();

    return {
      statusCode: 200,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        ok: true,
        stats: {
          total: Number(qStats.rows[0].total),
          active: Number(qStats.rows[0].active),
          expired: Number(qStats.rows[0].expired),
          closed: Number(qStats.rows[0].closed)
        },
        threads: qThreads.rows
      })
    };

  } catch (err) {
    console.error("burn-threads-admin error:", err);
    return {
      statusCode: 500,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        ok: false,
        error: err.message
      })
    };
  }
}
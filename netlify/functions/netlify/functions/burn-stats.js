// netlify/functions/burn-stats.js
// Burn Lane v2 – globální statistiky z Neon

import { Client } from "pg";

const connectionString =
  process.env.DATABASE_URL || process.env.NETLIFY_DATABASE_URL;

export async function handler(event) {
  try {
    const client = new Client({ connectionString });
    await client.connect();

    const res = await client.query(`
      SELECT
        COUNT(*) AS total,
        COUNT(*) FILTER (WHERE burned_at IS NULL) AS pending,
        AVG(ttl_hours)::float AS avg_ttl,
        AVG(
          EXTRACT(EPOCH FROM (burned_at - created_at))
        ) FILTER (WHERE burned_at IS NOT NULL)::float AS avg_burn_seconds
      FROM burn_notes
    `);

    await client.end();

    const row = res.rows[0] || {};
    const total = Number(row.total || 0);
    const pending = Number(row.pending || 0);
    const avgTtl = row.avg_ttl != null ? Number(row.avg_ttl) : null;
    const avgBurnSeconds =
      row.avg_burn_seconds != null ? Number(row.avg_burn_seconds) : null;

    return {
      statusCode: 200,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        ok: true,
        stats: {
          total,
          pending,
          avg_ttl: avgTtl,
          avg_burn_seconds: avgBurnSeconds
        }
      })
    };
  } catch (err) {
    console.error("burn-stats error:", err);
    return {
      statusCode: 500,
      body: JSON.stringify({ ok: false, error: err.message })
    };
  }
}

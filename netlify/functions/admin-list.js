// netlify/functions/admin-list.js
import { Client } from "pg";

export async function handler(event) {
  try {
    const key = event.queryStringParameters.key || "";
    const ownerKey = process.env.OWNER_DASH_CODE || "";

    if (!key || key !== ownerKey) {
      return {
        statusCode: 401,
        body: JSON.stringify({ ok: false, error: "Unauthorized" })
      };
    }

    const connectionString =
      process.env.DATABASE_URL || process.env.NETLIFY_DATABASE_URL;

    const client = new Client({ connectionString });
    await client.connect();

    // seznam posledních žádostí
    const listRes = await client.query(`
      SELECT
        id,
        alias,
        invite,
        contact,
        role_wanted,
        message,
        chain,
        tx_hash,
        support_note,
        status,
        created_at
      FROM inner_access_requests
      ORDER BY created_at DESC
      LIMIT 40
    `);

    // agregované statistiky
    const statsRes = await client.query(`
      SELECT
        COUNT(*) FILTER (WHERE status = 'pending')   AS pending,
        COUNT(*) FILTER (WHERE status = 'accepted')  AS accepted,
        COUNT(*) FILTER (WHERE status = 'rejected')  AS rejected,
        COUNT(*)                                     AS total,
        COUNT(*) FILTER (WHERE created_at::date = CURRENT_DATE) AS today
      FROM inner_access_requests
    `);

    await client.end();

    return {
      statusCode: 200,
      body: JSON.stringify({
        ok: true,
        items: listRes.rows,
        stats: statsRes.rows[0]
      })
    };
  } catch (err) {
    console.error("admin-list error:", err);
    return {
      statusCode: 500,
      body: JSON.stringify({ ok: false, error: err.message })
    };
  }
}

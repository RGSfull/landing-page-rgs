// netlify/functions/admin-list.js

import { Client } from "pg";

export async function handler(event) {
  try {
    // ---------- SECURITY ----------
    const key = event.queryStringParameters.key || "";
    const ownerKey = process.env.OWNER_DASH_CODE || ""; // doplň v Netlify variable

    if (!key || key !== ownerKey) {
      return {
        statusCode: 401,
        body: JSON.stringify({ ok: false, error: "Unauthorized" })
      };
    }

    // ---------- DB CONNECT ----------
    const connectionString =
      process.env.DATABASE_URL || process.env.NETLIFY_DATABASE_URL;

    const client = new Client({ connectionString });
    await client.connect();

    // ---------- GET LATEST ----------
    const query = `
      SELECT id, alias, invite, contact, role_wanted, message, chain, tx_hash, support_note, created_at
      FROM inner_access_requests
      ORDER BY created_at DESC
      LIMIT 30;
    `;

    const result = await client.query(query);
    await client.end();

    return {
      statusCode: 200,
      body: JSON.stringify({
        ok: true,
        items: result.rows
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

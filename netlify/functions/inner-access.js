import { Client } from "pg";

export async function handler(event, context) {
  try {
    if (event.httpMethod !== "POST") {
      return {
        statusCode: 200,
        body: JSON.stringify({ ok: true, info: "inner-access alive" })
      };
    }

    const data = JSON.parse(event.body || "{}");

    const client = new Client({
      connectionString:
        process.env.DATABASE_URL ||
        process.env.NETLIFY_DATABASE_URL
    });

    await client.connect();

    await client.query(
      `INSERT INTO inner_access_requests
      (alias, invite, contact, role_wanted, message, chain, tx_hash, support_note)
      VALUES ($1,$2,$3,$4,$5,$6,$7,$8)`,
      [
        data.alias || null,
        data.invite || null,
        data.contact || null,
        data.role || null,
        data.message || null,
        data.chain || null,
        data.tx || null,
        data.support_message || null
      ]
    );

    await client.end();

    return {
      statusCode: 200,
      body: JSON.stringify({ ok: true }),
      headers: { "Content-Type": "application/json" }
    };

  } catch (error) {
    console.error("inner-access error:", error);
    return {
      statusCode: 500,
      body: JSON.stringify({ ok: false, error: error.message }),
      headers: { "Content-Type": "application/json" }
    };
  }
}

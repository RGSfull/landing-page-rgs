// netlify/functions/inner-access.js
// Zapíše inner-access žádost + případný on-chain support do Neon (Postgres).

const { Client } = require("pg");

const DATABASE_URL = process.env.DATABASE_URL;

exports.handler = async (event) => {
  if (event.httpMethod !== "POST") {
    return { statusCode: 405, body: "Method Not Allowed" };
  }

  if (!DATABASE_URL) {
    return { statusCode: 500, body: "Missing DATABASE_URL" };
  }

  try {
    const body = JSON.parse(event.body || "{}");

    const alias   = (body.alias || "").toString().trim();
    const invite  = (body.invite || "").toString().trim();
    const contact = (body.contact || "").toString().trim();
    const role    = (body.role || "").toString().trim();
    const message = (body.message || "").toString().trim();
    const chain   = (body.chain || "").toString().trim();
    const tx      = (body.tx || "").toString().trim();
    const support = (body.support_message || "").toString().trim();

    if (!alias) {
      return { statusCode: 400, body: "Missing alias" };
    }

    const client = new Client({ connectionString: DATABASE_URL });
    await client.connect();

    // 1) inner_access_requests
    await client.query(
      `INSERT INTO inner_access_requests
       (alias, invite, contact, role_wanted, message, chain, tx_hash, support_note)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8)`,
      [alias, invite, contact, role, message, chain, tx, support]
    );

    // 2) support_events – jen když má něco on-chain
    if (chain || tx) {
      await client.query(
        `INSERT INTO support_events (alias, contact, chain, tx_hash, message)
         VALUES ($1,$2,$3,$4,$5)`,
        [alias, contact, chain, tx, support]
      );
    }

    await client.end();

    return {
      statusCode: 200,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ok: true })
    };
  } catch (err) {
    console.error("inner-access error:", err);
    return {
      statusCode: 500,
      body: "Server error"
    };
  }
};

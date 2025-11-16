// netlify/functions/admin-update.js
import { Client } from "pg";

export async function handler(event) {
  try {
    if (event.httpMethod !== "POST") {
      return {
        statusCode: 405,
        body: "Method Not Allowed"
      };
    }

    const key = event.queryStringParameters.key || "";
    const ownerKey = process.env.OWNER_DASH_CODE || "";
    if (!key || key !== ownerKey) {
      return {
        statusCode: 401,
        body: JSON.stringify({ ok: false, error: "Unauthorized" })
      };
    }

    const body = JSON.parse(event.body || "{}");
    const id = body.id;
    const action = body.action;

    if (!id || !action) {
      return {
        statusCode: 400,
        body: JSON.stringify({ ok: false, error: "Missing id or action" })
      };
    }

    let newStatus;
    if (action === "accept") newStatus = "accepted";
    else if (action === "reject") newStatus = "rejected";
    else if (action === "pending") newStatus = "pending";
    else {
      return {
        statusCode: 400,
        body: JSON.stringify({ ok: false, error: "Invalid action" })
      };
    }

    const connectionString =
      process.env.DATABASE_URL || process.env.NETLIFY_DATABASE_URL;

    const client = new Client({ connectionString });
    await client.connect();

    await client.query(
      `UPDATE inner_access_requests
       SET status = $1
       WHERE id = $2`,
      [newStatus, id]
    );

    await client.end();

    return {
      statusCode: 200,
      body: JSON.stringify({ ok: true })
    };
  } catch (err) {
    console.error("admin-update error:", err);
    return {
      statusCode: 500,
      body: JSON.stringify({ ok: false, error: err.message })
    };
  }
}

// netlify/functions/note-read.js
// Jednorázové přečtení: vrátí cipher+iv a smaže klíč z Redis.

const REDIS_URL = process.env.UPSTASH_REDIS_REST_URL;
const REDIS_TOKEN = process.env.UPSTASH_REDIS_REST_TOKEN;

exports.handler = async (event) => {
  if (event.httpMethod !== "POST") {
    return { statusCode: 405, body: "Method Not Allowed" };
  }

  if (!REDIS_URL || !REDIS_TOKEN) {
    return { statusCode: 500, body: "Missing Redis config" };
  }

  try {
    const body = JSON.parse(event.body || "{}");
    const { token } = body;

    if (!token) {
      return { statusCode: 400, body: "Missing token" };
    }

    // 1) GET
    const getUrl = `${REDIS_URL}/get/${token}`;
    const getRes = await fetch(getUrl, {
      headers: { Authorization: `Bearer ${REDIS_TOKEN}` },
    });

    if (!getRes.ok) {
      const text = await getRes.text();
      return {
        statusCode: 500,
        body: `Redis error: ${getRes.status} ${text}`,
      };
    }

    const getData = await getRes.json();

    // Upstash vrací { result: null } když nic není
    if (!getData || getData.result == null) {
      return {
        statusCode: 410, // Gone
        body: "Note already burned or not found",
      };
    }

    const payloadEncoded = getData.result;
    const payload = JSON.parse(decodeURIComponent(payloadEncoded));

    // 2) DEL (burn)
    const delUrl = `${REDIS_URL}/del/${token}`;
    await fetch(delUrl, {
      method: "POST",
      headers: { Authorization: `Bearer ${REDIS_TOKEN}` },
    }).catch(() => {});

    return {
      statusCode: 200,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload), // { cipher, iv }
    };
  } catch (err) {
    return {
      statusCode: 500,
      body: "Server error: " + (err && err.message ? err.message : String(err)),
    };
  }
};
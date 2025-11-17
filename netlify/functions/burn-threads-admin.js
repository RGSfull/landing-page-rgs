import { Client } from "pg";

export default async function handler(req, res) {
  if (req.method !== "GET") {
    return res.status(405).json({ ok: false, error: "Method not allowed" });
  }

  const { RGS_ADMIN_KEY, PGHOST, PGDATABASE, PGUSER, PGPASSWORD, PGPORT } = process.env;

  if (!RGS_ADMIN_KEY) {
    return res.status(500).json({ ok: false, error: "RGS_ADMIN_KEY not configured" });
  }

  const url = new URL(req.url, "http://localhost");
  const key = url.searchParams.get("key");

  if (!key || key !== RGS_ADMIN_KEY) {
    return res.status(401).json({ ok: false, error: "Unauthorized" });
  }

  if (!PGHOST || !PGDATABASE || !PGUSER || !PGPASSWORD || !PGPORT) {
    return res.status(500).json({ ok: false, error: "Database not configured" });
  }

  const client = new Client({
    host: PGHOST,
    database: PGDATABASE,
    user: PGUSER,
    password: PGPASSWORD,
    port: Number(PGPORT)
  });

  try {
    await client.connect();

    const statsQuery = `
      SELECT
        COUNT(*)::int AS total,
        COUNT(*) FILTER (WHERE escalated = true)::int AS escalated,
        COUNT(*) FILTER (WHERE closed_at IS NULL AND expires_at > now())::int AS open,
        COUNT(*) FILTER (WHERE closed_at IS NOT NULL OR expires_at <= now())::int AS closed,
        COUNT(*) FILTER (WHERE created_at::date = current_date)::int AS today
      FROM burn_threads;
    `;

    const listQuery = `
      SELECT
        t.id,
        t.token,
        t.created_at,
        t.expires_at,
        t.closed_at,
        t.escalated,
        COALESCE(m.cnt, 0)::int AS message_count
      FROM burn_threads t
      LEFT JOIN (
        SELECT thread_id, COUNT(*) AS cnt
        FROM burn_thread_messages
        GROUP BY thread_id
      ) m ON m.thread_id = t.id
      ORDER BY t.created_at DESC
      LIMIT 50;
    `;

    const [statsResult, listResult] = await Promise.all([
      client.query(statsQuery),
      client.query(listQuery)
    ]);

    const stats = statsResult.rows[0] || {
      total: 0,
      escalated: 0,
      open: 0,
      closed: 0,
      today: 0
    };

    return res.status(200).json({ ok: true, stats, threads: listResult.rows });
  } catch (e) {
    console.error("burn-threads-admin error", e);
    return res.status(500).json({ ok: false, error: "Internal error" });
  } finally {
    await client.end().catch(() => {});
  }
}

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ ok: false, error: "Method not allowed" });
  }

  try {
    const body = await new Promise((resolve, reject) => {
      let data = "";
      req.on("data", chunk => { data += chunk; });
      req.on("end", () => {
        try {
          resolve(JSON.parse(data || "{}"));
        } catch (e) {
          reject(e);
        }
      });
      req.on("error", reject);
    });

    const text = (body.message || "").trim();
    if (!text) {
      return res.status(400).json({ ok: false, error: "Missing message" });
    }

    const lower = text.toLowerCase();
    let reply;

    if (lower.startsWith("/plan")) {
      reply = "[stub/plan] rozložím ti to na kroky – zatím jen placeholder. popiš mi kontext a já zkusím navrhnout postup.";
    } else if (lower.startsWith("/mirror")) {
      reply = "[stub/mirror] zrcadlím co jsi napsal, ale zatím bez skutečné AI. napiš mi, co v tobě ten text vyvolává.";
    } else if (lower.startsWith("/ritual")) {
      reply = "[stub/ritual] představ si malý rituál · vypni rušiče, dej si vodu, zhluboka dýchej. skutečné rituály jednou doděláme.";
    } else {
      reply = "[stub] shadow chat zatím běží v placeholder režimu. napsal jsi: \"" + text + "\"";
    }

    return res.status(200).json({ ok: true, reply });
  } catch (e) {
    console.error("shadow-chat error", e);
    return res.status(500).json({ ok: false, error: "Internal error" });
  }
}

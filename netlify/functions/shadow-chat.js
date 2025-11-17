// netlify/functions/shadow-chat.js
// Pure Netlify Function — žádný Express, žádný req/res

export async function handler(event) {
  try {
    if (event.httpMethod !== "POST") {
      return {
        statusCode: 405,
        body: "Method Not Allowed"
      };
    }

    let body = {};
    try {
      body = JSON.parse(event.body || "{}");
    } catch {
      body = {};
    }

    const text = (body.message || "").trim().toLowerCase();

    const reactions = [
      "hmm… interesting. but not THAT interesting.",
      "try harder. i’m barely awake.",
      "i've seen toddlers type faster.",
      "your keyboard must suffer.",
      "čteš vůbec co píšeš? já jo. a bolí to.",
      "okay. that was… something.",
      "fatal error: user detected.",
      "keep typing. i need the entertainment."
    ];

    let reply = reactions[Math.floor(Math.random() * reactions.length)];

    // Easter eggs
    if (text.includes("help"))
      reply = "help? in *this* lane? adorable.";
    if (text.includes("hello"))
      reply = "hello organism. identify your purpose.";
    if (text.includes(":)") || text.includes("😂") || text.includes("🙂"))
      reply = "smiling? bold of you. it won’t last.";
    if (text.includes("fuck"))
      reply = "such language. your ancestors weep.";

    return {
      statusCode: 200,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        ok: true,
        shadow: reply
      })
    };

  } catch (err) {
    console.error("shadow-chat error:", err);
    return {
      statusCode: 500,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ok: false, error: err.message })
    };
  }
}

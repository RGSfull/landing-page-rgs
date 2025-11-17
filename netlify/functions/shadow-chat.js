// netlify/functions/shadow-chat.js
// Minimalistický backend pro AI Shadow (offline / bez OpenAI)

export async function handler(event) {
  try {
    if (event.httpMethod !== "POST") {
      return {
        statusCode: 405,
        body: "Method Not Allowed"
      };
    }

    const body = JSON.parse(event.body || "{}");
    const text = (body.message || "").trim().toLowerCase();

    // fallback odpovědi – simulace "AI-shadow"
    const reactions = [
      "hmm… interesting. but not THAT interesting.",
      "try harder. I’m barely awake.",
      "i've seen toddlers type faster.",
      "your keyboard must suffer.",
      "čteš vůbec co píšeš? já jo. a bolí to.",
      "okay. that was… something.",
      "fatal error: user detected.",
      "keep typing. i need the entertainment."
    ];

    let reply = reactions[Math.floor(Math.random() * reactions.length)];

    // easter egg reagující na zprávu
    if (text.includes("help")) reply = "help? in *this* lane? cute.";
    if (text.includes("hello")) reply = "hello human organism ― identify yourself.";
    if (text.includes(":)") || text.includes("😂") || text.includes("🙂")) {
      reply = "i see your smile. it won't last.";
    }
    if (text.includes("fuck")) reply = "such vocabulary. your mother must be proud.";

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
      body: JSON.stringify({ ok: false, error: err.message })
    };
  }
}

import fetch from "node-fetch";

export async function handler(event) {
  try {
    const query = event.queryStringParameters.q;
    if (!query) {
      return {
        statusCode: 400,
        body: JSON.stringify({ error: "Missing ?q= parameter" }),
      };
    }

    // DuckDuckGo API – bez klíče
    const url = `https://api.duckduckgo.com/?q=${encodeURIComponent(query)}&format=json&no_redirect=1&no_html=1`;

    const res = await fetch(url);
    const data = await res.json();

    return {
      statusCode: 200,
      headers: {
        "Content-Type": "application/json",
        "Access-Control-Allow-Origin": "*"
      },
      body: JSON.stringify({
        ok: true,
        query,
        abstract: data.Abstract || null,
        answer: data.Answer || null,
        relatedTopics: (data.RelatedTopics || []).slice(0, 5),
        raw: data
      }),
    };
  } catch (err) {
    return {
      statusCode: 500,
      body: JSON.stringify({ error: err.message }),
    };
  }
}

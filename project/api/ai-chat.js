// Vercel serverless function: real AI chat for the Smart Placement Cell Portal.
// Lives at /api/ai-chat (Vercel auto-routes anything in /api). Runs server-side
// so the ANTHROPIC_API_KEY is never exposed to the browser.
//
// Set ANTHROPIC_API_KEY in your Vercel project's Environment Variables
// (Project → Settings → Environment Variables) — do NOT put it in .env / VITE_*
// vars, since anything prefixed VITE_ gets bundled into the public JS.

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return res.status(200).json({ ai: false, reason: "no_api_key" });
  }

  const { question, profile, matches } = req.body || {};
  if (!question || typeof question !== "string") {
    return res.status(400).json({ error: "Missing 'question'" });
  }

  // Keep the payload small — only what the model needs to give a grounded answer.
  const context = {
    skills: profile?.skills || [],
    cgpa: profile?.cgpa || null,
    branch: profile?.branch || null,
    top_matches: (matches || []).slice(0, 5).map((m) => ({
      company: m.companies?.name || m.name,
      role: m.companies?.role || m.role,
      match_score: m.match_score,
      missing_skills: m.missing_skills || [],
    })),
  };

  const system = `You are the AI career assistant inside a college placement portal. \
Answer the student's question using ONLY the profile/match data given to you as JSON context. \
Be concise (under 120 words), concrete, and encouraging but honest. \
Use simple HTML for emphasis (<strong>, <br>) since your reply is rendered directly in a chat bubble — no markdown, no code fences.`;

  try {
    const upstream = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: "claude-sonnet-4-6",
        max_tokens: 400,
        system,
        messages: [
          {
            role: "user",
            content: `Student context: ${JSON.stringify(context)}\n\nQuestion: ${question}`,
          },
        ],
      }),
    });

    if (!upstream.ok) {
      const errText = await upstream.text();
      console.error("Anthropic API error:", upstream.status, errText);
      return res.status(200).json({ ai: false, reason: "upstream_error" });
    }

    const data = await upstream.json();
    const text = (data.content || [])
      .filter((b) => b.type === "text")
      .map((b) => b.text)
      .join("\n")
      .trim();

    return res.status(200).json({ ai: true, reply: text });
  } catch (err) {
    console.error("ai-chat function failed:", err);
    return res.status(200).json({ ai: false, reason: "exception" });
  }
}

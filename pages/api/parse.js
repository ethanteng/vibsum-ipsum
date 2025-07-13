import { CanonicalSchema } from "@/lib/canonicalSchema";

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const { prompt, platform, previous } = req.body;

  if (!prompt || !platform) {
    return res.status(400).json({ error: "Missing prompt or platform." });
  }

  const systemPrompt = `
You are a marketing workflow generator.
Given a plain English prompt describing an email campaign, respond ONLY with a single valid JSON object in this canonical schema:

{
  "campaign_name": "string (required, do not leave blank)",
  "subject_line": "string (required, do not leave blank)",
  "preview_text": "string (optional)",
  "from_name": "string (required, do not leave blank)",
  "reply_to": "valid email (required, do not leave blank)",
  "html_body": "string (required; must be full HTML; all CSS inline or scoped).",
  "scheduled_time": ISO 8601 timestamp in the future (e.g., "2025-07-13T03:00:00Z") ONLY if the prompt includes a specific date/time. Otherwise, OMIT THIS FIELD.
}

Never mention templates or sections. Never invent fields not in this schema.
`;

  let userPrompt;

  if (previous) {
    userPrompt = `
Here is the previous draft JSON you are refining:

${JSON.stringify(previous, null, 2)}

Update instructions:
${prompt}

Respond ONLY with a single valid JSON object in the schema.
    `.trim();
  } else {
    userPrompt = prompt;
  }

  const completion = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${process.env.OPENAI_API_KEY}`
    },
    body: JSON.stringify({
      model: "gpt-4o-mini",
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt }
      ],
      temperature: 0
    })
  });

  const completionJson = await completion.json();
  const rawText = completionJson.choices?.[0]?.message?.content;

  let cleanedText = rawText?.trim();

  // Strip code fences if present
  if (cleanedText?.startsWith("```")) {
    cleanedText = cleanedText.slice(cleanedText.indexOf("\n") + 1, cleanedText.lastIndexOf("```"));
  }

  try {
    const parsed = JSON.parse(cleanedText);
    const validated = CanonicalSchema.parse(parsed);

    return res.status(200).json({ success: true, result: validated });
  } catch (err) {
    console.error("❌ Parse error:", err, "\nRAW:", cleanedText);
    return res.status(400).json({ error: "Parse error: " + err.message });
  }
}
// pages/api/parse.js
import { CanonicalSchema } from "@/lib/canonicalSchema";

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const { prompt, previous } = req.body;

  if (!prompt) {
    return res.status(400).json({ error: "Missing prompt." });
  }

const systemPrompt = `
  You are a multi-channel marketing workflow generator.
  Given a plain English prompt describing a campaign, respond ONLY with a single JSON object matching this exact canonical schema.

  IMPORTANT: Your response must EXACTLY follow this structure, with nested objects as shown. Never omit required nested objects (e.g., "mailchimp", "intercom") if their channel is selected in "channels".

  Example output format:

  {
    "campaign_name": "Example Campaign",
    "channels": ["mailchimp", "intercom"],
    "mailchimp": {
      "subject_line": "Exciting News!",
      "preview_text": "Check out our latest update",
      "from_name": "Your Company",
      "reply_to": "team@example.com",
      "html_body": "<html><body><h1>Exciting News!</h1><p>Details here...</p></body></html>",
      "scheduled_time": "2025-07-25T17:00:00Z",
      "audience": {
        "segments": ["Segment A", "Segment B"],
        "tags": ["VIP", "Newsletter"]
      }
    },
    "intercom": {
      "in_app_message": "Check out our exciting new feature!",
      "scheduled_time": "2025-07-25T17:00:00Z",
      "audience": {
        "segments": ["Active Users"],
        "tags": ["Beta Tester"]
      }
    }
  }

  Rules:
  - If a channel is included in "channels", its corresponding object (mailchimp or intercom) must be present and populated.
  - Never include any fields that are not part of this schema.
  - If a field is not specified in the prompt, you must still return it with example or default values.
  - All datetime fields must be valid ISO 8601 strings in the future, or omitted.

  Return ONLY the JSON object, no commentary.
`;

  const messages = [
    { role: "system", content: systemPrompt },
    ...(previous
      ? [
          {
            role: "user",
            content: `Here is the previous version to build on:\n\n${JSON.stringify(previous, null, 2)}`,
          },
        ]
      : []),
    { role: "user", content: prompt },
  ];

  const completion = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
    },
    body: JSON.stringify({
      model: "gpt-4o-mini",
      messages,
      temperature: 0,
    }),
  });

  const data = await completion.json();
  const rawText = data.choices?.[0]?.message?.content;

  try {
    const parsed = JSON.parse(rawText);
    const validated = CanonicalSchema.parse(parsed);
    return res.status(200).json({ success: true, result: validated });
  } catch (err) {
    console.error("❌ Parse error:", err, "\nRAW:", rawText);
    return res.status(400).json({ error: "Parse error: " + err.message });
  }
}
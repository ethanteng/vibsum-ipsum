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
Given a plain English prompt describing a campaign or refinements, respond ONLY with a single JSON object matching this canonical schema:

{
  "campaign_name": "string (required)",
  "channels": ["mailchimp", "intercom"], // at least one
  "mailchimp": {
    "subject_line": "string",
    "preview_text": "string",
    "from_name": "string",
    "reply_to": "valid email",
    "html_body": "string",
    "scheduled_time": "ISO 8601 timestamp or omit",
    "audience": {
      "segments": ["Segment Name"],
      "tags": ["Tag Name"]
    }
  },
  "intercom": {
    "in_app_message": "string",
    "audience": {
      "segments": ["Segment Name"],
      "tags": ["Tag Name"]
    }
  }
}

Important rules:
- When a previous version is provided:
   - Only modify the channel(s) explicitly mentioned in the prompt.
   - If no channels are mentioned, update all channels.
- Never invent fields not in this schema.
`;

  const messages = [
    { role: "system", content: systemPrompt },
    ...(previous
      ? [
          { role: "assistant", content: JSON.stringify(previous) },
          { role: "user", content: prompt },
        ]
      : [{ role: "user", content: prompt }]),
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

    // If previous exists, merge intelligently
    let merged;
    if (previous) {
      merged = {
        ...previous,
        ...parsed,
        mailchimp:
          parsed.mailchimp !== undefined
            ? parsed.mailchimp
            : previous.mailchimp,
        intercom:
          parsed.intercom !== undefined
            ? parsed.intercom
            : previous.intercom,
      };

      // Channels array should reflect the *currently included* channels
      merged.channels = [];
      if (merged.mailchimp) merged.channels.push("mailchimp");
      if (merged.intercom) merged.channels.push("intercom");
    } else {
      merged = parsed;
    }

    const validated = CanonicalSchema.parse(merged);
    return res.status(200).json({ success: true, result: validated });
  } catch (err) {
    console.error("❌ Parse error:", err, "\nRAW:", rawText);
    return res.status(400).json({ error: "Parse error: " + err.message });
  }
}
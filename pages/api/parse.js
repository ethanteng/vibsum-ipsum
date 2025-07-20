// pages/api/parse.js
import { canonicalSchema } from "@/lib/canonicalSchema";

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
      "segments": ["VIP Customers", "Newsletter Subscribers"]
    }
  },
  "intercom": {
    "news_title": "string",
    "news_markdown": "string (markdown format)",
    "post_plaintext": "string (plain text only, max 500 characters)",
    "banner_text": "string (plain text only, max 80 characters, single line)"
  }
}

Important rules:
- When a previous version is provided:
   - If the user explicitly requests to remove a channel, omit that channel object entirely.
   - If the user mentions modifying only certain channels, include only those channels (and omit the others).
   - If the user does not specify any channels, include all channels fully.
- Never invent fields not in this schema.
- If you include any channel object, you MUST include all required fields for that channel.
- For intercom.news_markdown, include markdown headings, bold, lists, and links if appropriate.
- For intercom.post_plaintext, remove all markdown and return plain text only.
- For intercom.banner_text, write a short, catchy, single-line message under 80 characters.
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

    // Safe merging helpers
    const hasRequiredMailchimp = (obj) =>
      obj &&
      typeof obj === "object" &&
      ["subject_line", "from_name", "reply_to", "html_body"].every(
        (field) => obj[field]
      );

    const hasRequiredIntercom = (obj) =>
      obj &&
      typeof obj === "object" &&
      ["news_title", "news_markdown", "post_plaintext", "banner_text"].every(
        (field) => obj[field]
      );

    let merged;
    if (previous) {
      merged = {
        ...previous,
        ...parsed,
        mailchimp:
          hasRequiredMailchimp(parsed.mailchimp)
            ? parsed.mailchimp
            : previous.mailchimp,
        intercom:
          hasRequiredIntercom(parsed.intercom)
            ? parsed.intercom
            : previous.intercom,
      };

      // Recompute channels array
      merged.channels = [];
      if (merged.mailchimp) merged.channels.push("mailchimp");
      if (merged.intercom) merged.channels.push("intercom");
    } else {
      merged = parsed;
    }

    // Set default scheduled_time if not specified
    if (merged.mailchimp && !merged.mailchimp.scheduled_time) {
      const defaultTime = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();
      merged.mailchimp.scheduled_time = defaultTime;
    }

    console.log("✅ Final merged object before validation:", JSON.stringify(merged, null, 2));

    const validated = canonicalSchema.parse(merged);

    return res.status(200).json({ success: true, result: validated });
  } catch (err) {
    console.error("❌ Parse error:", err, "\nRAW:", rawText);
    return res.status(400).json({ error: "Parse error: " + err.message });
  }
}
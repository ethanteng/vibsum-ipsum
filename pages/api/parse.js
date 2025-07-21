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

  // Before calling the AI model, fetch recent Mailchimp and Intercom content
  const [mailchimpContent, intercomContent] = await Promise.all([
    fetch(`${process.env.NEXTAUTH_URL || "http://localhost:3000"}/api/mailchimp/recent-campaigns`, {
      headers: req.headers
    }).then(r => r.ok ? r.json() : { campaigns: [] }),
    fetch(`${process.env.NEXTAUTH_URL || "http://localhost:3000"}/api/intercom/recent-content`, {
      headers: req.headers
    }).then(r => r.ok ? r.json() : { content: [] })
  ]);

  // Build a system prompt for the AI
  function buildSystemPrompt(mailchimpContent, intercomContent) {
    let prompt = "You are an expert email/newsletter copywriter for this company. Here are recent examples of their style and language.\n\n";
    if (mailchimpContent.campaigns && mailchimpContent.campaigns.length > 0) {
      prompt += "Recent Mailchimp Campaigns:\n";
      mailchimpContent.campaigns.forEach(c => {
        prompt += `Subject: ${c.subject_line || "(no subject)"}\nPreview: ${c.preview_text || "(no preview)"}\nBody: ${(c.plain_text || c.html || "(no content)").slice(0, 500)}\n---\n`;
      });
    }
    if (intercomContent.content && intercomContent.content.length > 0) {
      prompt += "Recent Intercom Content:\n";
      intercomContent.content.forEach(item => {
        prompt += `Type: ${item.type}\nTitle: ${item.title || "(no title)"}\nBody: ${(item.body || "(no content)").slice(0, 500)}\n---\n`;
      });
    }
    prompt += `\nPlease match the tone, style, and language of these examples in all future responses.\n\nIMPORTANT: Respond ONLY with a single JSON object matching the schema below. Do NOT include any commentary, explanation, or extra text. Your response MUST be valid JSON only. Do not include markdown, code blocks, or any other formatting. If you cannot answer, respond with an empty JSON object: {}.\n\nHere is the required JSON schema. Respond ONLY with a single object matching this structure:\n\n` +
      `{
  "campaign_name": "string",
  "channels": ["mailchimp", "intercom"],
  "mailchimp": {
    "subject_line": "string",
    "preview_text": "string",
    "from_name": "string",
    "reply_to": "string",
    "html_body": "string",
    "scheduled_time": "string (ISO date)",
    "audience": {
      "segments": ["string"]
    }
  },
  "intercom": {
    "news_title": "string",
    "news_markdown": "string",
    "post_plaintext": "string",
    "banner_text": "string"
  }
}`;
    return prompt;
  }

  const systemPrompt = buildSystemPrompt(mailchimpContent, intercomContent);

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
  let rawText = data.choices?.[0]?.message?.content;

  // Extract the first JSON object from the AI response, if necessary
  // This helps if the AI includes extra text or formatting by mistake
  let jsonText = rawText;
  if (typeof rawText === "string") {
    const match = rawText.match(/\{[\s\S]*\}/);
    if (match) {
      if (match[0].length !== rawText.length) {
        console.warn("AI response contained extra text. Extracted JSON block.");
      }
      jsonText = match[0];
    }
  }

  try {
    const parsed = JSON.parse(jsonText);

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
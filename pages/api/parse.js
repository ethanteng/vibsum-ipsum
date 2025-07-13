import fetch from "node-fetch";
import { CanonicalSchema } from "@/lib/canonicalSchema";
import { normalizeForMailchimp } from "@/lib/normalizeForMailchimp";
import { normalizeForKlaviyo } from "@/lib/normalizeForKlaviyo";

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const { prompt, platform, previous } = req.body;

  const systemPrompt = `
  You are a marketing workflow generator.
  Given a plain English prompt describing an email campaign, respond ONLY with a single valid JSON object in this canonical schema:

  {
    "campaign_name": "string (required, do not leave blank)",
    "subject_line": "string (required, do not leave blank)",
    "preview_text": "string",
    "from_name": "string (required, do not leave blank)",
    "reply_to": "valid email (required, do not leave blank)",
    "html_body": "string (required, do not leave blank, should be full HTML)",
    "scheduled_time": ISO 8601 timestamp in the future (e.g., "2025-07-12T09:45:00Z"). If you are not sure, or no specific time is requested, omit this key entirely.
  }

  Make sure all keys are present unless instructed to omit them. 
  If you cannot confidently determine a valid *future* scheduled_time, **omit it**.
  `;

  const messages = [
    { role: "system", content: systemPrompt },
  ];

  if (previous) {
    messages.push({
      role: "user",
      content: `Here is the previous version you should start from:\n\n${JSON.stringify(previous, null, 2)}`
    });
  }

  messages.push({
    role: "user",
    content: prompt
  });

  const completion = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${process.env.OPENAI_API_KEY}`
    },
    body: JSON.stringify({
      model: "gpt-4.1",
      messages,
      temperature: 0
    })
  });

  const data = await completion.json();
  console.log("🔍 FULL OPENAI RESPONSE >>>", JSON.stringify(data, null, 2));

  if (!data.choices || !data.choices[0]) {
    return res.status(500).json({ error: "No completion choices returned", raw: data });
  }

  let text = data.choices[0].message.content.trim();
  console.log("🔍 RAW GPT OUTPUT >>>", text);

  if (text.startsWith("```")) {
    text = text.replace(/```[a-z]*\n?/i, "").replace(/```$/, "");
  }

  let canonical;
  try {
    const parsed = JSON.parse(text);
    canonical = typeof parsed === "string" ? JSON.parse(parsed) : parsed;

    // Validate here
    CanonicalSchema.parse(canonical);
  } catch (err) {
    return res.status(400).json({
      error: "Failed to parse or validate JSON.",
      raw: text,
      stack: err.toString()
    });
  }

  // If no scheduled_time, set to 24h from now
  if (!canonical.scheduled_time) {
    const defaultTime = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();
    canonical.scheduled_time = defaultTime;
  }

  // Return canonical output with resolved scheduled_time for preview
  return res.status(200).json({
    success: true,
    result: canonical
  });
}
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
      "html_body": "string (required if no sections, should be full HTML). IMPORTANT: All CSS must be inline or inside <style> tags that only target elements inside the email, not global elements like <body> or <html>.",
      "scheduled_time": ISO 8601 timestamp in the future (e.g., "2025-07-13T03:00:00Z"). If no specific time is requested, omit this field.
      "template_name": "string (optional)",
      "template_id": number (optional),
      "sections": object mapping section names to HTML strings (optional)
    }

    If sections are used, html_body can be empty.
    Never include styles targeting global selectors like body, html, or *.
    Only include scheduled_time if the prompt mentions a specific date/time.
  `;

  const messages = [{ role: "system", content: systemPrompt }];

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
      model: "gpt-4o-mini",
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

    // Clean empty string fields
    if (canonical.scheduled_time === "") delete canonical.scheduled_time;
    if (canonical.template_id === "") delete canonical.template_id;
    if (canonical.html_body === "") delete canonical.html_body;

    console.log("🔍 CanonicalSchema content:", CanonicalSchema);

    // Validate
    CanonicalSchema.parse(canonical);
  } catch (err) {
    console.error("Validation error:", err);
    return res.status(400).json({
      error: "Failed to parse or validate JSON.",
      raw: text,
      stack: err.toString()
    });
  }

  return res.status(200).json({
    success: true,
    result: canonical
  });
}
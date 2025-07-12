import fetch from "node-fetch";
import { normalizeForMailchimp } from "@/lib/normalizeForMailchimp";
import { normalizeForKlaviyo } from "@/lib/normalizeForKlaviyo"; // create this if needed

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const { prompt, platform, previous } = req.body;

  const systemPrompt = `
You are a marketing workflow generator.
Given a plain English prompt describing an email campaign, respond ONLY with a single valid JSON object in this canonical schema:

{
  "campaign_name": "",
  "subject_line": "",
  "preview_text": "",
  "from_name": "",
  "reply_to": "",
  "html_body": "",
  "send_after_inactivity_days": 0
}

If a previous version is provided, start with that as your base and modify it only to address the new prompt.
Make sure all keys are present.
`;

  // Compose messages dynamically
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

  // Call OpenAI
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
  } catch (err) {
    return res.status(400).json({
      error: "Failed to parse JSON.",
      raw: text,
      stack: err.toString()
    });
  }

  // Validate and normalize
  let normalized;
  try {
    if (platform === "mailchimp") {
      normalized = normalizeForMailchimp(canonical);
    } else if (platform === "klaviyo") {
      normalized = normalizeForKlaviyo(canonical);
    } else {
      normalized = {};
    }
  } catch (err) {
    return res.status(400).json({
      error: "Normalization error: " + err.message,
      raw: canonical
    });
  }

  // Return only parsed + normalized JSON
  return res.status(200).json({
    success: true,
    result: canonical,
    normalized
  });
}
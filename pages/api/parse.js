import fetch from "node-fetch";
import { normalizeForMailchimp } from "@/lib/normalizeForMailchimp";
import { normalizeForKlaviyo } from "@/lib/normalizeForKlaviyo"; // create this if needed

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const { prompt, platform } = req.body;

  const systemPrompt = `
You are a marketing workflow generator.
Given a plain English prompt describing an email campaign,
respond ONLY with a single valid JSON object in this canonical schema:

{
  "campaign_name": "",
  "subject_line": "",
  "preview_text": "",
  "from_name": "",
  "reply_to": "",
  "html_body": "",
  "send_after_inactivity_days": 0
}

Make sure all keys are present.
`;

  const completion = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${process.env.OPENAI_API_KEY}`
    },
    body: JSON.stringify({
      model: "gpt-4.1",
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: prompt }
      ],
      temperature: 0
    })
  });

  const data = await completion.json();
  console.log("🔍 FULL OPENAI RESPONSE >>>", JSON.stringify(data, null, 2));

  if (!data.choices || !data.choices[0]) {
    return res.status(500).json({ error: "No completion choices returned", raw: data });
  }

  let text = data.choices[0].message.content.trim();
  console.log("🔍 RAW GPT OUTPUT >>>", JSON.stringify(text));

  if (text.startsWith("```")) {
    text = text.replace(/```[a-z]*\n?/i, "");
    text = text.replace(/```$/, "");
  }

  let canonical;
  try {
    let parsed = JSON.parse(text);
    canonical = typeof parsed === "string" ? JSON.parse(parsed) : parsed;
  } catch (err) {
    return res.status(400).json({
      error: "Failed to parse JSON.",
      raw: text,
      stack: err.toString()
    });
  }

  // Validate + normalize
  let normalized;
  try {
    if (platform === "mailchimp") {
      normalized = normalizeForMailchimp(canonical);
    } else if (platform === "klaviyo") {
      normalized = normalizeForKlaviyo(canonical);
    } else {
      throw new Error("Unsupported platform: " + platform);
    }
  } catch (err) {
    return res.status(400).json({
      error: "Invalid canonical output or normalization error: " + err.message,
      raw: canonical
    });
  }

  return res.status(200).json(normalized);
}
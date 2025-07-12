import fetch from "node-fetch";

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const { prompt } = req.body;

  const systemPrompt = `
You are a marketing workflow generator.
Given a plain English prompt describing an email campaign,
respond ONLY with a single valid JSON object and no other text.
Make sure to include the opening and closing braces.
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

  // Remove code fences if any
  if (text.startsWith("```")) {
    text = text.replace(/```[a-z]*\n?/i, "");
    text = text.replace(/```$/, "");
  }

  let json;

  try {
    let parsed = JSON.parse(text);

    if (typeof parsed === "string") {
      console.log("Parsed first pass was string, parsing again...");
      json = JSON.parse(parsed);
    } else {
      json = parsed;
    }
  } catch (err) {
    return res.status(400).json({
      error: "Failed to parse JSON.",
      raw: text,
      stack: err.toString()
    });
  }

  return res.status(200).json({ result: json });
}
// lib/createIntercomNewsItem.js

export async function createIntercomNewsItem({ canonical, apiKey, appId }) {
  // Convert markdown to HTML (Intercom News requires HTML)
  const markdownIt = require("markdown-it")();
  const htmlBody = markdownIt.render(canonical.intercom.news_markdown);

  const payload = {
    title: canonical.intercom.news_title,
    body: htmlBody,
    state: "draft",
    deliver_silently: false,
    sender_id: 8548749
  };

  const res = await fetch("https://api.intercom.io/news/news_items", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
      "Intercom-Version": "2.13"
    },
    body: JSON.stringify(payload)
  });

  if (!res.ok) {
    throw new Error(`Intercom News create error: ${await res.text()}`);
  }

  const created = await res.json();

  return {
    id: created.id,
    url: `https://app.intercom.com/a/apps/${appId}/news`
  };
}
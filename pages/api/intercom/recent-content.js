import { getServerSession } from "next-auth/next";
import { authOptions } from "../auth/[...nextauth]";
import { getUserIntercomToken } from "../../../lib/getUserTokens";

export default async function handler(req, res) {
  if (req.method !== "GET") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    const session = await getServerSession(req, res, authOptions);
    if (!session) {
      return res.status(401).json({ error: "Not authenticated" });
    }

    // Get user's Intercom token
    const intercomToken = await getUserIntercomToken(session.user.id);
    if (!intercomToken) {
      return res.status(400).json({ 
        error: "Intercom not connected. Please connect your account in Settings > Connections." 
      });
    }

    // Fetch recent News items
    const newsRes = await fetch("https://api.intercom.io/news", {
      headers: {
        Authorization: `Bearer ${intercomToken}`,
        "Content-Type": "application/json",
        Accept: "application/json",
      },
    });
    let newsItems = [];
    if (newsRes.ok) {
      const newsData = await newsRes.json();
      newsItems = (newsData.news_items || []).slice(0, 3).map(n => ({
        id: n.id,
        type: "news",
        title: n.title,
        body: n.body,
        created_at: n.created_at
      }));
    }

    // Fetch recent Outbound Messages (Posts and Emails)
    const outboundRes = await fetch("https://api.intercom.io/messages/outbound", {
      headers: {
        Authorization: `Bearer ${intercomToken}`,
        "Content-Type": "application/json",
        Accept: "application/json",
      },
    });
    let outboundItems = [];
    if (outboundRes.ok) {
      const outboundData = await outboundRes.json();
      outboundItems = (outboundData.messages || [])
        .filter(m => m.message_type === "email" || m.message_type === "post")
        .slice(0, 3)
        .map(m => ({
          id: m.id,
          type: m.message_type, // 'email' or 'post'
          title: m.subject || m.title || "",
          body: m.body || m.content?.body || "",
          created_at: m.created_at
        }));
    }

    // Combine and sort all items by created_at descending
    const allItems = [...newsItems, ...outboundItems]
      .sort((a, b) => (b.created_at || 0) - (a.created_at || 0))
      .slice(0, 3); // Only keep the 3 most recent overall

    return res.status(200).json({ content: allItems });
  } catch (error) {
    console.error("Error fetching recent Intercom content:", error);
    return res.status(500).json({ error: error.message });
  }
} 
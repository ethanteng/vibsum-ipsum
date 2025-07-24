import { getServerSession } from "next-auth/next";
import { authOptions } from "../auth/[...nextauth]";
import { getUserMailchimpToken, getUserIntercomToken } from "../../../lib/getUserTokens";
import { ingestMailchimpCampaigns, ingestIntercomContent, isIngestionNeeded, updateLastIngestedAt } from "../../../lib/ingestContent";

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    const session = await getServerSession(req, res, authOptions);
    if (!session) {
      return res.status(401).json({ error: "Not authenticated" });
    }
    const userId = session.user.id;

    // Only ingest if data is stale
    const needsIngestion = await isIngestionNeeded(userId);
    if (!needsIngestion) {
      return res.status(200).json({ success: true, ingested: false, reason: "Data is fresh" });
    }

    let mailchimpIngested = 0;
    let intercomIngested = 0;

    // --- Mailchimp ---
    const mailchimpToken = await getUserMailchimpToken(userId);
    if (mailchimpToken) {
      const campaignsRes = await fetch(
        `https://${process.env.MAILCHIMP_DC}.api.mailchimp.com/3.0/campaigns?sort_field=send_time&sort_dir=DESC&count=3`,
        {
          headers: {
            Authorization: `Bearer ${mailchimpToken}`,
            "Content-Type": "application/json",
          },
        }
      );
      if (campaignsRes.ok) {
        const campaignsData = await campaignsRes.json();
        const campaigns = campaignsData.campaigns || [];
        const campaignDetails = await Promise.all(
          campaigns.map(async (c) => {
            const contentRes = await fetch(
              `https://${process.env.MAILCHIMP_DC}.api.mailchimp.com/3.0/campaigns/${c.id}/content`,
              {
                headers: {
                  Authorization: `Bearer ${mailchimpToken}`,
                  "Content-Type": "application/json",
                },
              }
            );
            let content = {};
            if (contentRes.ok) {
              content = await contentRes.json();
            }
            return {
              id: c.id,
              subject: c.settings?.subject_line || "",
              body: content.plain_text || content.html || "",
              sentAt: c.send_time || new Date().toISOString(),
            };
          })
        );
        await ingestMailchimpCampaigns(userId, campaignDetails);
        mailchimpIngested = campaignDetails.length;
      }
    }

    // --- Intercom ---
    const intercomToken = await getUserIntercomToken(userId);
    if (intercomToken) {
      // News
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
          title: n.title || "",
          body: n.body || "",
          sentAt: n.created_at ? new Date(n.created_at * 1000).toISOString() : new Date().toISOString(),
        }));
      }
      // Outbound
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
            title: m.subject || m.title || "",
            body: m.body || m.content?.body || "",
            sentAt: m.created_at ? new Date(m.created_at * 1000).toISOString() : new Date().toISOString(),
          }));
      }
      const allItems = [...newsItems, ...outboundItems].slice(0, 3);
      await ingestIntercomContent(userId, allItems);
      intercomIngested = allItems.length;
    }

    // Update lastIngestedAt
    await updateLastIngestedAt(userId);

    return res.status(200).json({ success: true, ingested: true, mailchimpIngested, intercomIngested });
  } catch (error) {
    console.error("Error ingesting content:", error);
    return res.status(500).json({ error: error.message });
  }
} 
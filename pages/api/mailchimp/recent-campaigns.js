import { getServerSession } from "next-auth/next";
import { authOptions } from "../auth/[...nextauth]";
import { getUserMailchimpToken } from "../../../lib/getUserTokens";

export default async function handler(req, res) {
  if (req.method !== "GET") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    const session = await getServerSession(req, res, authOptions);
    if (!session) {
      return res.status(401).json({ error: "Not authenticated" });
    }

    // Get user's Mailchimp token
    const mailchimpToken = await getUserMailchimpToken(session.user.id);
    if (!mailchimpToken) {
      return res.status(400).json({ 
        error: "Mailchimp not connected. Please connect your account in Settings > Connections." 
      });
    }

    // Fetch recent campaigns
    const campaignsRes = await fetch(
      `https://${process.env.MAILCHIMP_DC}.api.mailchimp.com/3.0/campaigns?sort_field=send_time&sort_dir=DESC&count=3`,
      {
        headers: {
          Authorization: `Bearer ${mailchimpToken}`,
          "Content-Type": "application/json",
        },
      }
    );
    if (!campaignsRes.ok) {
      throw new Error(`Failed to fetch campaigns: ${await campaignsRes.text()}`);
    }
    const campaignsData = await campaignsRes.json();
    const campaigns = campaignsData.campaigns || [];

    // Fetch content for each campaign
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
          subject_line: c.settings?.subject_line,
          preview_text: c.settings?.preview_text,
          send_time: c.send_time,
          html: content.html,
          plain_text: content.plain_text,
        };
      })
    );

    return res.status(200).json({ campaigns: campaignDetails });
  } catch (error) {
    console.error("Error fetching recent Mailchimp campaigns:", error);
    return res.status(500).json({ error: error.message });
  }
} 
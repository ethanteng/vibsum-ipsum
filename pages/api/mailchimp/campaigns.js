// pages/api/mailchimp/campaigns.js
import { getServerSession } from "next-auth/next";
import { authOptions } from "../auth/[...nextauth]";
import { getUserMailchimpToken } from "@/lib/getUserTokens";

export default async function handler(req, res) {
  if (req.method !== "GET") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  // Get user session
  const session = await getServerSession(req, res, authOptions);
  if (!session?.user?.id) {
    return res.status(401).json({ error: "Unauthorized" });
  }

  try {
    // Get user's Mailchimp token
    const mailchimpToken = await getUserMailchimpToken(session.user.id);
    if (!mailchimpToken) {
      return res.status(400).json({ 
        error: "Mailchimp not connected. Please connect your account in Settings > Connections." 
      });
    }

    // Fetch campaigns from Mailchimp
    const campaignsRes = await fetch(
      `https://${process.env.MAILCHIMP_DC}.api.mailchimp.com/3.0/campaigns?count=50&status=sent`,
      {
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${mailchimpToken}`,
        },
      }
    );

    if (!campaignsRes.ok) {
      throw new Error(`Failed to fetch campaigns: ${await campaignsRes.text()}`);
    }

    const campaignsData = await campaignsRes.json();
    const campaigns = campaignsData.campaigns || [];

    // For each campaign, fetch its content to get the HTML template
    const campaignsWithContent = await Promise.all(
      campaigns.map(async (campaign) => {
        try {
          const contentRes = await fetch(
            `https://${process.env.MAILCHIMP_DC}.api.mailchimp.com/3.0/campaigns/${campaign.id}/content`,
            {
              headers: {
                "Content-Type": "application/json",
                Authorization: `Bearer ${mailchimpToken}`,
              },
            }
          );

          if (!contentRes.ok) {
            console.warn(`Failed to fetch content for campaign ${campaign.id}`);
            return {
              id: campaign.id,
              web_id: campaign.web_id,
              title: campaign.settings?.title || "Untitled",
              subject_line: campaign.settings?.subject_line || "",
              send_time: campaign.send_time,
              html: null,
              error: "Failed to fetch content"
            };
          }

          const contentData = await contentRes.json();
          
          return {
            id: campaign.id,
            web_id: campaign.web_id,
            title: campaign.settings?.title || "Untitled",
            subject_line: campaign.settings?.subject_line || "",
            send_time: campaign.send_time,
            html: contentData.html,
            plain_text: contentData.plain_text
          };
        } catch (error) {
          console.error(`Error fetching content for campaign ${campaign.id}:`, error);
          return {
            id: campaign.id,
            web_id: campaign.web_id,
            title: campaign.settings?.title || "Untitled",
            subject_line: campaign.settings?.subject_line || "",
            send_time: campaign.send_time,
            html: null,
            error: error.message
          };
        }
      })
    );

    // Filter out campaigns without HTML content
    const validCampaigns = campaignsWithContent.filter(campaign => campaign.html);

    return res.status(200).json({ campaigns: validCampaigns });
  } catch (error) {
    console.error("Error fetching Mailchimp campaigns:", error);
    return res.status(500).json({ error: error.message });
  }
} 
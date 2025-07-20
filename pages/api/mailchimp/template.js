// pages/api/mailchimp/template.js
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

  const { templateId } = req.query;

  if (!templateId) {
    return res.status(400).json({ error: "Missing templateId parameter" });
  }

  try {
    // Get user's Mailchimp token
    const mailchimpToken = await getUserMailchimpToken(session.user.id);
    if (!mailchimpToken) {
      return res.status(400).json({ 
        error: "Mailchimp not connected. Please connect your account in Settings > Connections." 
      });
    }

    // Fetch template HTML from Mailchimp
    const templateRes = await fetch(
      `https://${process.env.MAILCHIMP_DC}.api.mailchimp.com/3.0/campaigns/${templateId}/content`,
      {
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${mailchimpToken}`,
        },
      }
    );

    if (!templateRes.ok) {
      throw new Error(`Failed to fetch template: ${await templateRes.text()}`);
    }

    const templateData = await templateRes.json();
    
    return res.status(200).json({ 
      html: templateData.html,
      plain_text: templateData.plain_text 
    });
  } catch (error) {
    console.error("Error fetching template:", error);
    return res.status(500).json({ error: error.message });
  }
} 
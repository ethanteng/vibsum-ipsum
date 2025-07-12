import { normalizeForMailchimp } from "@/lib/normalizeForMailchimp";
import { normalizeForKlaviyo } from "@/lib/normalizeForKlaviyo";

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const { platform, canonical } = req.body;

  if (!platform || !canonical) {
    return res.status(400).json({ error: "Missing platform or canonical data." });
  }

  try {
    if (platform === "mailchimp") {
      const { campaignPayload, contentPayload } = normalizeForMailchimp(canonical);

      // Create the campaign
      const createRes = await fetch(`https://${process.env.MAILCHIMP_DC}.api.mailchimp.com/3.0/campaigns`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `apikey ${process.env.MAILCHIMP_API_KEY}`
        },
        body: JSON.stringify(campaignPayload)
      });

      if (!createRes.ok) {
        const errText = await createRes.text();
        throw new Error(`Mailchimp create campaign failed: ${errText}`);
      }

      const campaignResponse = await createRes.json();
      console.log("✅ Created Mailchimp campaign:", campaignResponse);

      // Set the content
      const contentRes = await fetch(`https://${process.env.MAILCHIMP_DC}.api.mailchimp.com/3.0/campaigns/${campaignResponse.id}/content`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          Authorization: `apikey ${process.env.MAILCHIMP_API_KEY}`
        },
        body: JSON.stringify(contentPayload)
      });

      if (!contentRes.ok) {
        const errText = await contentRes.text();
        throw new Error(`Mailchimp set content failed: ${errText}`);
      }

      console.log("✅ Set Mailchimp content successfully");

      return res.status(200).json({
        success: true,
        mailchimpCampaignId: campaignResponse.id,
        campaignWebId: campaignResponse.web_id,
        campaignDetailsUrl: `https://${process.env.MAILCHIMP_DC}.admin.mailchimp.com/campaigns/edit?id=${campaignResponse.web_id}`,
        campaignPayload,
        contentPayload
      });

    } else if (platform === "klaviyo") {
      const klaviyoPayload = normalizeForKlaviyo(canonical);

      // TODO: actually create the campaign in Klaviyo here
      console.log("✅ Normalized payload for Klaviyo:", klaviyoPayload);

      return res.status(200).json({
        success: true,
        klaviyoPayload
      });

    } else {
      throw new Error(`Unsupported platform: ${platform}`);
    }

  } catch (err) {
    console.error("❌ Create error:", err);
    return res.status(400).json({
      error: "Create error: " + err.message
    });
  }
}
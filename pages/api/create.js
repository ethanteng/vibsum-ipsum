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
      const { campaignPayload, contentPayload, scheduled_time } = normalizeForMailchimp(canonical);

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

      let schedulingStatus = "not_requested";

      if (scheduled_time) {
        console.log("⏰ Attempting to schedule for:", scheduled_time);
        const scheduleRes = await fetch(`https://${process.env.MAILCHIMP_DC}.api.mailchimp.com/3.0/campaigns/${campaignResponse.id}/actions/schedule`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `apikey ${process.env.MAILCHIMP_API_KEY}`
          },
          body: JSON.stringify({ schedule_time: scheduled_time })
        });

        if (scheduleRes.ok) {
          schedulingStatus = "scheduled_successfully";
          console.log("✅ Campaign scheduled successfully");
        } else {
          const errText = await scheduleRes.text();
          console.warn("⚠️ Scheduling failed:", errText);
          schedulingStatus = "schedule_failed";
        }
      }

      return res.status(200).json({
        success: true,
        mailchimpCampaignId: campaignResponse.id,
        campaignWebId: campaignResponse.web_id,
        campaignDetailsUrl: `https://${process.env.MAILCHIMP_DC}.admin.mailchimp.com/campaigns/edit?id=${campaignResponse.web_id}`,
        scheduled_time_requested: !!scheduled_time,
        schedulingStatus,
        campaignPayload,
        contentPayload
      });

    } else if (platform === "klaviyo") {
      const klaviyoPayload = normalizeForKlaviyo(canonical);

      // TODO: Actually create the campaign in Klaviyo here
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
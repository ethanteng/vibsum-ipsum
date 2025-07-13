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

      let finalContentPayload = contentPayload;

      // If no contentPayload was built by normalizeForMailchimp, fall back to your dynamic logic
      if (
        !finalContentPayload ||
        (Object.keys(finalContentPayload).length === 0 && finalContentPayload.constructor === Object)
      ) {
        finalContentPayload = {};

        if (
          canonical.sections &&
          typeof canonical.sections === "object" &&
          !Array.isArray(canonical.sections) &&
          Object.keys(canonical.sections).length > 0
        ) {
          finalContentPayload.sections = canonical.sections;
        } else if (
          canonical.html_body &&
          canonical.template_id
        ) {
          console.log("🔍 Fetching template sections for template ID:", canonical.template_id);
          const templateRes = await fetch(`https://${process.env.MAILCHIMP_DC}.api.mailchimp.com/3.0/templates/${canonical.template_id}`, {
            headers: {
              "Content-Type": "application/json",
              Authorization: `apikey ${process.env.MAILCHIMP_API_KEY}`
            }
          });

          if (!templateRes.ok) {
            const errText = await templateRes.text();
            throw new Error(`Failed to fetch template: ${errText}`);
          }

          const templateData = await templateRes.json();
          const sectionKeys = Object.keys(templateData.sections || {});

          if (sectionKeys.length === 0) {
            throw new Error(`Template has no editable sections.`);
          }

          finalContentPayload.sections = {
            [sectionKeys[0]]: canonical.html_body
          };

          console.log("✅ Using section:", sectionKeys[0]);
        } else if (
          canonical.html_body &&
          canonical.html_body.trim().length > 0
        ) {
          finalContentPayload.html = canonical.html_body;
        } else {
          throw new Error("No content provided.");
        }
      }

      // Set the content
      const contentRes = await fetch(`https://${process.env.MAILCHIMP_DC}.api.mailchimp.com/3.0/campaigns/${campaignResponse.id}/content`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          Authorization: `apikey ${process.env.MAILCHIMP_API_KEY}`
        },
        body: JSON.stringify(finalContentPayload)
      });

      if (!contentRes.ok) {
        const errText = await contentRes.text();
        throw new Error(`Mailchimp set content failed: ${errText}`);
      }

      console.log("✅ Set Mailchimp content successfully");

      // Schedule if applicable
      let schedulingStatus = "not_requested";
      if (scheduled_time) {
        console.log("⏰ Scheduling for:", scheduled_time);

        const scheduleTimeMs = Date.parse(scheduled_time);
        if (isNaN(scheduleTimeMs)) {
          throw new Error(`Invalid scheduled time: ${scheduled_time}`);
        }
        if (scheduleTimeMs <= Date.now()) {
          throw new Error(`Scheduled time must be in the future: ${scheduled_time}`);
        }

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
          console.error("⚠️ Schedule failed:", errText);
          schedulingStatus = "schedule_failed";
        }
      }

      return res.status(200).json({
        success: true,
        mailchimpCampaignId: campaignResponse.id,
        campaignWebId: campaignResponse.web_id,
        campaignDetailsUrl: `https://${process.env.MAILCHIMP_DC}.admin.mailchimp.com/campaigns/edit?id=${campaignResponse.web_id}`,
        schedulingStatus
      });
    }

    // Klaviyo (stub)
    else if (platform === "klaviyo") {
      const klaviyoPayload = normalizeForKlaviyo(canonical);
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
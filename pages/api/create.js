// pages/api/create.js
import { normalizeForMailchimp } from "@/lib/normalizeForMailchimp";
import { resolveMailchimpTargets } from "@/lib/resolveMailchimpTargets";

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const { canonical, channels } = req.body;
  const results = {};

  try {
    if (channels.includes("mailchimp")) {
      const resolved = await resolveMailchimpTargets(canonical.mailchimp.audience);

      const { campaignPayload, contentPayload, scheduled_time } =
        normalizeForMailchimp(canonical, resolved);

      const createRes = await fetch(`https://${process.env.MAILCHIMP_DC}.api.mailchimp.com/3.0/campaigns`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `apikey ${process.env.MAILCHIMP_API_KEY}`,
        },
        body: JSON.stringify(campaignPayload),
      });

      if (!createRes.ok) {
        throw new Error(`Mailchimp create failed: ${await createRes.text()}`);
      }

      const campaign = await createRes.json();

      const contentRes = await fetch(`https://${process.env.MAILCHIMP_DC}.api.mailchimp.com/3.0/campaigns/${campaign.id}/content`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          Authorization: `apikey ${process.env.MAILCHIMP_API_KEY}`,
        },
        body: JSON.stringify(contentPayload),
      });

      if (!contentRes.ok) {
        throw new Error(`Mailchimp content failed: ${await contentRes.text()}`);
      }

      const scheduleRes = await fetch(`https://${process.env.MAILCHIMP_DC}.api.mailchimp.com/3.0/campaigns/${campaign.id}/actions/schedule`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `apikey ${process.env.MAILCHIMP_API_KEY}`,
        },
        body: JSON.stringify({ schedule_time: scheduled_time }),
      });

      results.mailchimp = {
        status: scheduleRes.ok ? "scheduled" : "created_unscheduled",
        url: `https://${process.env.MAILCHIMP_DC}.admin.mailchimp.com/campaigns/edit?id=${campaign.web_id}`,
      };
    }

    if (channels.includes("intercom")) {
      results.intercom = { status: "not yet implemented" };
    }

    return res.status(200).json({ success: true, results });
  } catch (err) {
    console.error("❌ Create error:", err);
    return res.status(400).json({ error: "Create error: " + err.message });
  }
}
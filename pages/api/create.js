// pages/api/create.js
import { normalizeForMailchimp } from "@/lib/normalizeForMailchimp";
import { resolveMailchimpTargets } from "@/lib/resolveMailchimpTargets";

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const { canonical, channels } = req.body;

  if (!canonical || !channels || !Array.isArray(channels)) {
    return res.status(400).json({ error: "Missing canonical or channels array." });
  }

  const results = {};

  if (channels.includes("mailchimp")) {
    try {
      const {
        resolvedSegments,
        resolvedTags,
        unresolvedSegments,
        unresolvedTags
      } = await resolveMailchimpTargets({
        segmentNames: canonical.mailchimp.audience?.segments || [],
        tagNames: canonical.mailchimp.audience?.tags || []
      });

      const { campaignPayload, contentPayload, scheduled_time } = normalizeForMailchimp(canonical);

      if (resolvedSegments.length > 0) {
        campaignPayload.recipients.segment_opts = {
          saved_segment_id: resolvedSegments[0].id,
        };
      }

      const createRes = await fetch(
        `https://${process.env.MAILCHIMP_DC}.api.mailchimp.com/3.0/campaigns`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `apikey ${process.env.MAILCHIMP_API_KEY}`,
          },
          body: JSON.stringify(campaignPayload),
        }
      );
      if (!createRes.ok) throw new Error(`Create error: ${await createRes.text()}`);
      const created = await createRes.json();

      const contentRes = await fetch(
        `https://${process.env.MAILCHIMP_DC}.api.mailchimp.com/3.0/campaigns/${created.id}/content`,
        {
          method: "PUT",
          headers: {
            "Content-Type": "application/json",
            Authorization: `apikey ${process.env.MAILCHIMP_API_KEY}`,
          },
          body: JSON.stringify(contentPayload),
        }
      );
      if (!contentRes.ok) throw new Error(`Content error: ${await contentRes.text()}`);

      let scheduleStatus = "not_requested";
      if (scheduled_time) {
        const schedRes = await fetch(
          `https://${process.env.MAILCHIMP_DC}.api.mailchimp.com/3.0/campaigns/${created.id}/actions/schedule`,
          {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              Authorization: `apikey ${process.env.MAILCHIMP_API_KEY}`,
            },
            body: JSON.stringify({ schedule_time: scheduled_time }),
          }
        );
        scheduleStatus = schedRes.ok ? "scheduled_successfully" : "schedule_failed";
      }

      results.mailchimp = {
        status: scheduleStatus,
        url: `https://${process.env.MAILCHIMP_DC}.admin.mailchimp.com/campaigns/edit?id=${created.web_id}`,
        unresolvedSegments,
        unresolvedTags,
      };
    } catch (err) {
      console.error("Mailchimp error:", err);
      results.mailchimp = { error: err.message };
    }
  }

  return res.status(200).json({ results });
}
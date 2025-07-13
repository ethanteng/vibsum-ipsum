// pages/api/create.js
export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

  const { platform, canonical } = req.body;
  if (!platform || !canonical?.html_body) {
    return res.status(400).json({ error: "Missing platform or html_body." });
  }

  try {
    if (platform === "mailchimp") {
      const campaignRes = await fetch(
        `https://${process.env.MAILCHIMP_DC}.api.mailchimp.com/3.0/campaigns`,
        {
          method: "POST",
          headers: {
            Authorization: `apikey ${process.env.MAILCHIMP_API_KEY}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            type: "regular",
            recipients: { list_id: process.env.MAILCHIMP_LIST_ID },
            settings: {
              subject_line: canonical.subject_line,
              preview_text: canonical.preview_text,
              from_name: canonical.from_name,
              reply_to: canonical.reply_to,
              title: canonical.campaign_name,
            },
          }),
        }
      );
      if (!campaignRes.ok) throw new Error(await campaignRes.text());
      const campaign = await campaignRes.json();

      const contentRes = await fetch(
        `https://${process.env.MAILCHIMP_DC}.api.mailchimp.com/3.0/campaigns/${campaign.id}/content`,
        {
          method: "PUT",
          headers: {
            Authorization: `apikey ${process.env.MAILCHIMP_API_KEY}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ html: canonical.html_body }),
        }
      );
      if (!contentRes.ok) throw new Error(await contentRes.text());

      let scheduleMsg = "Created as draft";
      if (canonical.scheduled_time) {
        const scheduleRes = await fetch(
          `https://${process.env.MAILCHIMP_DC}.api.mailchimp.com/3.0/campaigns/${campaign.id}/actions/schedule`,
          {
            method: "POST",
            headers: {
              Authorization: `apikey ${process.env.MAILCHIMP_API_KEY}`,
              "Content-Type": "application/json",
            },
            body: JSON.stringify({ schedule_time: canonical.scheduled_time }),
          }
        );
        scheduleRes.ok
          ? (scheduleMsg = "Scheduled for " + canonical.scheduled_time)
          : (scheduleMsg = "Created but failed to schedule");
      }

      return res.status(200).json({
        message: scheduleMsg,
        url: `https://${process.env.MAILCHIMP_DC}.admin.mailchimp.com/campaigns/edit?id=${campaign.web_id}`,
      });
    }

    // stub for Klaviyo
    res.status(200).json({ message: "Klaviyo not implemented yet" });
  } catch (e) {
    console.error(e);
    res.status(400).json({ error: e.message });
  }
}
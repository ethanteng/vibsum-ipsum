import { CanonicalSchema } from "./canonicalSchema";

/**
 * @param {object} gptData - Raw GPT output JSON
 * @returns {object} { campaignPayload, contentPayload, scheduled_time }
 */
export function normalizeForMailchimp(gptData) {
  const canonical = CanonicalSchema.parse(gptData);

  // Base campaign payload
  const campaignPayload = {
    type: "regular",
    recipients: {
      list_id: process.env.MAILCHIMP_LIST_ID
    },
    settings: {
      subject_line: canonical.subject_line,
      preview_text: canonical.preview_text,
      from_name: canonical.from_name,
      reply_to: canonical.reply_to,
      title: canonical.campaign_name
    }
  };

  if (canonical.segment_opts) {
    campaignPayload.recipients.segment_opts = canonical.segment_opts;
  }

  if (canonical.template_id) {
    campaignPayload.settings.template_id = canonical.template_id;
  }

  // Determine scheduled_time
  let scheduledTime = null;
  if (canonical.scheduled_time) {
    const parsed = new Date(canonical.scheduled_time);
    if (!isNaN(parsed.getTime()) && parsed > new Date()) {
      scheduledTime = parsed.toISOString();
    } else {
      console.log("⚠️ Provided scheduled_time invalid or in the past. Defaulting to 24h from now.");
    }
  }

  if (!scheduledTime) {
    const fallback = new Date();
    fallback.setHours(fallback.getHours() + 24);
    scheduledTime = fallback.toISOString();
  }

  const contentPayload = {
    html: canonical.html_body
  };

  return {
    campaignPayload,
    contentPayload,
    scheduled_time: scheduledTime
  };
}
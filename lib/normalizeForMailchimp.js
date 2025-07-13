import { CanonicalSchema } from "./canonicalSchema";

/**
 * @param {object} gptData - Raw GPT output JSON
 * @returns {object} { campaignPayload, contentPayload, scheduled_time }
 */
export function normalizeForMailchimp(gptData) {
  const canonical = CanonicalSchema.parse(gptData);

  const campaignPayload = {
    type: "regular",
    recipients: {
      list_id: process.env.MAILCHIMP_LIST_ID
    },
    settings: {
      subject_line: canonical.subject_line,
      preview_text: canonical.preview_text || "",
      from_name: canonical.from_name,
      reply_to: canonical.reply_to,
      title: canonical.campaign_name
    }
  };

  if (canonical.segment_opts) {
    campaignPayload.recipients.segment_opts = canonical.segment_opts;
  }

  const contentPayload = {
    html: canonical.html_body
  };

  let scheduled_time;

  if (canonical.scheduled_time) {
    const parsedTime = Date.parse(canonical.scheduled_time);
    if (!isNaN(parsedTime) && parsedTime > Date.now()) {
      // Valid and in the future
      scheduled_time = new Date(parsedTime).toISOString();
    } else {
      console.warn(
        `⚠️ Provided scheduled_time "${canonical.scheduled_time}" is invalid or not in the future. Defaulting to 24h from now.`
      );
      scheduled_time = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();
    }
  } else {
    // No scheduled time provided
    scheduled_time = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();
  }

  return {
    campaignPayload,
    contentPayload,
    scheduled_time
  };
}
import { CanonicalSchema } from "./canonicalSchema";

/**
 * @param {object} gptData - Raw GPT output JSON
 * @returns {object} { campaignPayload, contentPayload, scheduled_time }
 */
export function normalizeForMailchimp(gptData) {
  // Validate canonical schema
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

  // Segment targeting
  if (canonical.segment_opts) {
    campaignPayload.recipients.segment_opts = canonical.segment_opts;
  }

  // Template selection
  if (canonical.template_id) {
    campaignPayload.settings.template_id = canonical.template_id;
  }

  // Prepare content payload
  let contentPayload;
  if (canonical.sections && Object.keys(canonical.sections).length > 0) {
    contentPayload = {
      sections: canonical.sections
    };
  } else if (canonical.html_body) {
    contentPayload = {
      html: canonical.html_body
    };
  } else {
    throw new Error("Neither html_body nor sections were provided.");
  }

  // Determine scheduled time
  let scheduled_time;
  if (canonical.scheduled_time) {
    scheduled_time = canonical.scheduled_time;
  } else {
    scheduled_time = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();
  }

  return {
    campaignPayload,
    contentPayload,
    scheduled_time
  };
}
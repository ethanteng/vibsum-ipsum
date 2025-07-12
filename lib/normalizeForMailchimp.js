import { CanonicalSchema } from "./canonicalSchema";

/**
 * @param {object} gptData - Raw GPT output JSON
 * @returns {object} { campaignPayload, contentPayload }
 */
export function normalizeForMailchimp(gptData) {
  // Validate canonical schema
  const canonical = CanonicalSchema.parse(gptData);

  // Prepare Mailchimp-specific payloads
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

  const contentPayload = {
    html: canonical.html_body
  };

  // 🔥 Merge any advanced options into settings
  if (canonical.advanced_options && canonical.advanced_options.settings) {
    Object.assign(campaignPayload.settings, canonical.advanced_options.settings);
  }

  return { campaignPayload, contentPayload };
}
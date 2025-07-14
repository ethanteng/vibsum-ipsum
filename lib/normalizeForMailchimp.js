// lib/normalizeForMailchimp.js
import { CanonicalSchema } from "./canonicalSchema";

export function normalizeForMailchimp(gptData, resolvedTargets) {
  const canonical = CanonicalSchema.parse(gptData);

  const m = canonical.mailchimp;

  const campaignPayload = {
    type: "regular",
    recipients: {
      list_id: process.env.MAILCHIMP_LIST_ID,
    },
    settings: {
      subject_line: m.subject_line,
      preview_text: m.preview_text || "",
      from_name: m.from_name,
      reply_to: m.reply_to,
      title: canonical.campaign_name,
    },
  };

  // Apply resolved targeting
  if (resolvedTargets?.segment_opts) {
    campaignPayload.recipients.segment_opts = resolvedTargets.segment_opts;
  }

  const contentPayload = {
    html: m.html_body,
  };

  const scheduled_time =
    m.scheduled_time || new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();

  return {
    campaignPayload,
    contentPayload,
    scheduled_time,
  };
}
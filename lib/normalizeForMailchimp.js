// lib/normalizeForMailchimp.js
import { canonicalSchema } from "./canonicalSchema";
import { extractMailchimpTemplateSimple } from "./extractMailchimpTemplate";

export function normalizeForMailchimp(gptData, resolvedTargets, templateHtml = null) {
  const canonical = canonicalSchema.parse(gptData);

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

  // Use template if provided, otherwise use the original HTML body
  let htmlBody = m.html_body;
  if (templateHtml) {
    htmlBody = extractMailchimpTemplateSimple(templateHtml, m.html_body);
  }

  const contentPayload = {
    html: htmlBody,
  };

let scheduled_time;
if (m.scheduled_time) {
  // Always parse and convert to UTC
  const parsed = new Date(m.scheduled_time);
  scheduled_time = parsed.toISOString();
} else {
  scheduled_time = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();
}

  return {
    campaignPayload,
    contentPayload,
    scheduled_time,
  };
}
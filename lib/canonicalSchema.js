// lib/canonicalSchema.js
import { z } from "zod";

export const canonicalSchema = z.object({
  campaign_name: z.string(),
  channels: z.array(z.enum(["mailchimp", "intercom"])),
  mailchimp: z.object({
    subject_line: z.string(),
    preview_text: z.string(),
    from_name: z.string(),
    reply_to: z.string(),
    html_body: z.string(),
    scheduled_time: z.string(),
    audience: z.object({
      segments: z.array(z.string()).optional(),
    }),
  }),
  intercom: z.object({
    news_title: z.string(),
    news_markdown: z.string(),
    post_plaintext: z.string(),
    banner_text: z.string(),
  }),
});
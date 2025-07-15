// lib/canonicalSchema.js
import { z } from "zod";

export const CanonicalSchema = z.object({
  campaign_name: z.string().min(1, "campaign_name is required"),
  channels: z
    .array(z.enum(["mailchimp", "intercom"]))
    .min(1, "At least one channel is required"),
  mailchimp: z.object({
    subject_line: z.string().min(1, "subject_line is required"),
    preview_text: z.string().optional(),
    from_name: z.string().min(1, "from_name is required"),
    reply_to: z.string().email("Must be a valid email"),
    html_body: z.string().min(1, "html_body is required"),
    scheduled_time: z.string().nullable().optional(),
    audience: z
      .object({
        segments: z.array(z.string()).optional(),
        tags: z.array(z.string()).optional(),
      })
      .optional(),
  }),
  intercom: z.object({
    news_title: z.string().min(1, "News title is required"),
    news_markdown: z.string().min(1, "news_markdown is required"),
    post_plaintext: z
      .string()
      .max(500, "Post plaintext must be 500 characters or fewer")
      .min(1, "post_plaintext is required"),
    banner_text: z
      .string()
      .max(80, "Banner text must be 80 characters or fewer")
      .min(1, "banner_text is required"),
    audience: z
      .object({
        segments: z.array(z.string()).optional(),
        tags: z.array(z.string()).optional(),
      })
      .optional(),
  }).optional(),
});
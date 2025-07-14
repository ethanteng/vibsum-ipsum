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
    scheduled_time: z.string().optional(), // no datetime() to avoid brittle validation
    audience: z
      .object({
        segments: z.array(z.string()).optional(),
        tags: z.array(z.string()).optional(),
      })
      .optional(),
  }),
  intercom: z.object({
    in_app_message: z.string().min(1, "in_app_message is required"),
    scheduled_time: z.string().optional(),
    audience: z
      .object({
        segments: z.array(z.string()).optional(),
        tags: z.array(z.string()).optional(),
      })
      .optional(),
  }),
});
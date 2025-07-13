import { z } from "zod";

export const CanonicalSchema = z.object({
  campaign_name: z.string().min(1, "Campaign name is required."),
  subject_line: z.string().min(1, "Subject line is required."),
  preview_text: z.string().optional(),
  from_name: z.string().min(1, "From name is required."),
  reply_to: z.string().email("Must be a valid email."),
  html_body: z.string().min(1, "HTML body is required."),
  scheduled_time: z
    .string()
    .datetime()
    .optional(),
  segment_opts: z.record(z.any()).optional()
});
import { z } from "zod";

export const CanonicalSchema = z.object({
  campaign_name: z.string(),
  subject_line: z.string(),
  preview_text: z.string().optional().default(""),
  from_name: z.string().default("Your Brand"),
  reply_to: z.string().email().default("support@yourbrand.com"),
  html_body: z.string(),
  send_after_inactivity_days: z.number().int().default(0)
});
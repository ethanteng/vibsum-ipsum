// lib/canonicalSchema.js
import { z } from "zod";

export const canonicalSchema = z.object({
  mailchimp: z.object({
    subject_line: z.string(),
    preview_text: z.string(),
    from_name: z.string(),
    reply_to: z.string(),
    audience: z.object({
      segments: z.array(z.string()).optional(),
    }),
    content: z.object({
      title: z.string(),
      body: z.string(),
    }),
  }),
  intercom: z.object({
    news_title: z.string(),
    news_markdown: z.string(),
    post_plaintext: z.string(),
    banner_text: z.string(),
  }),
});
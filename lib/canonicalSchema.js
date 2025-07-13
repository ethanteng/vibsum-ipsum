import { z } from "zod";

export const CanonicalSchema = z
  .object({
    campaign_name: z.string().min(1, "campaign_name is required"),
    subject_line: z.string().min(1, "subject_line is required"),
    preview_text: z.string().optional(),
    from_name: z.string().min(1, "from_name is required"),
    reply_to: z.string().email(),
    html_body: z.string().optional().nullable(),
    scheduled_time: z.string().datetime().optional(), // Simple datetime, no unions
    template_id: z.number().optional(),
    template_name: z.string().optional(),
    segment_opts: z
      .object({
        saved_segment_id: z.number()
      })
      .optional(),
    sections: z.record(z.string()).optional()
  })
  .refine(
    (data) => {
      const hasHtml =
        typeof data.html_body === "string" && data.html_body.trim().length > 0;
      const hasSections =
        data.sections && Object.keys(data.sections).length > 0;
      return hasHtml || hasSections;
    },
    {
      message: "Either html_body or sections must be provided."
    }
  );
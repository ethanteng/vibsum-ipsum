// pages/api/create.js
import { getServerSession } from "next-auth/next";
import { authOptions } from "./auth/[...nextauth]";
import { normalizeForMailchimp } from "@/lib/normalizeForMailchimp";
import { resolveMailchimpTargets } from "@/lib/resolveMailchimpTargets";
import { createIntercomNewsItem } from "@/lib/createIntercomNewsItem";
import { getUserMailchimpToken, getUserIntercomToken } from "@/lib/getUserTokens";

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  console.log('Create endpoint - Request headers:', req.headers);
  console.log('Create endpoint - Cookies:', req.headers.cookie);

  // Get user session
  const session = await getServerSession(req, res, authOptions);
  console.log('Create endpoint - Session:', { 
    hasSession: !!session, 
    userId: session?.user?.id,
    userEmail: session?.user?.email
  });
  
  if (!session?.user?.id) {
    console.log('Create endpoint - No session or no user ID');
    return res.status(401).json({ error: "Unauthorized" });
  }

  const { canonical, channels } = req.body;

  if (!canonical || !channels || !Array.isArray(channels)) {
    return res.status(400).json({ error: "Missing canonical or channels array." });
  }

  const results = {};

  if (channels.includes("mailchimp")) {
    try {
      // Get user's Mailchimp token
      const mailchimpToken = await getUserMailchimpToken(session.user.id);
      console.log('Mailchimp token found:', !!mailchimpToken);
      
      if (!mailchimpToken) {
        results.mailchimp = { 
          error: "Mailchimp not connected. Please connect your account in Settings > Connections." 
        };
        return res.status(200).json({ results });
      }

      const {
        resolvedSegments,
        resolvedTags,
        unresolvedSegments,
        unresolvedTags
      } = await resolveMailchimpTargets({
        segmentNames: canonical.mailchimp.audience?.segments || [],
        tagNames: canonical.mailchimp.audience?.tags || []
      });

      const { campaignPayload, contentPayload, scheduled_time } = normalizeForMailchimp(canonical);

      if (resolvedSegments.length > 0) {
        campaignPayload.recipients.segment_opts = {
          saved_segment_id: resolvedSegments[0].id,
        };
      }

      const createRes = await fetch(
        `https://${process.env.MAILCHIMP_DC}.api.mailchimp.com/3.0/campaigns`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${mailchimpToken}`,
          },
          body: JSON.stringify(campaignPayload),
        }
      );
      if (!createRes.ok) throw new Error(`Create error: ${await createRes.text()}`);
      const created = await createRes.json();

      const contentRes = await fetch(
        `https://${process.env.MAILCHIMP_DC}.api.mailchimp.com/3.0/campaigns/${created.id}/content`,
        {
          method: "PUT",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${mailchimpToken}`,
          },
          body: JSON.stringify(contentPayload),
        }
      );
      if (!contentRes.ok) throw new Error(`Content error: ${await contentRes.text()}`);

      let scheduleStatus = "not_requested";
      if (scheduled_time) {
        const schedRes = await fetch(
          `https://${process.env.MAILCHIMP_DC}.api.mailchimp.com/3.0/campaigns/${created.id}/actions/schedule`,
          {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              Authorization: `Bearer ${mailchimpToken}`,
            },
            body: JSON.stringify({ schedule_time: scheduled_time }),
          }
        );
        scheduleStatus = schedRes.ok ? "scheduled_successfully" : "schedule_failed";
      }

      results.mailchimp = {
        status: scheduleStatus,
        url: `https://${process.env.MAILCHIMP_DC}.admin.mailchimp.com/campaigns/edit?id=${created.web_id}`,
        unresolvedSegments,
        unresolvedTags,
      };
    } catch (err) {
      console.error("Mailchimp error:", err);
      results.mailchimp = { error: err.message };
    }
  }

  // INTERCOM NEWS
  if (channels.includes("intercom")) {
    try {
      // Get user's Intercom token
      const intercomToken = await getUserIntercomToken(session.user.id);
      if (!intercomToken) {
        results.intercom = { 
          error: "Intercom not connected. Please connect your account in Settings > Connections." 
        };
        return res.status(200).json({ results });
      }

      const created = await createIntercomNewsItem({
        canonical,
        apiKey: intercomToken,
        appId: process.env.NEXT_PUBLIC_INTERCOM_APP_ID,
      });

      results.intercom = {
        status: "created",
        url: created.url,
      };
    } catch (err) {
      console.error("Intercom News error:", err);
      results.intercom = { error: err.message };
    }
  }

  return res.status(200).json({ results });
}
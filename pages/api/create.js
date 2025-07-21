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

  // Get user session
  const session = await getServerSession(req, res, authOptions);
  
  if (!session?.user?.id) {
    return res.status(401).json({ error: "Unauthorized" });
  }

  const { canonical, channels, templateId, selectedMailchimpSegment, selectedIntercomSegment } = req.body;

  if (!canonical || !channels || !Array.isArray(channels)) {
    return res.status(400).json({ error: "Missing canonical or channels array." });
  }

  const results = {};

  if (channels.includes("mailchimp")) {
    try {
      // Get user's Mailchimp token
      const mailchimpToken = await getUserMailchimpToken(session.user.id);
      
      if (!mailchimpToken) {
        results.mailchimp = { 
          error: "Mailchimp not connected. Please connect your account in Settings > Connections." 
        };
        return res.status(200).json({ results });
      }

      // Use selected segment or resolve automatically
      let segmentTarget = null;
      let resolvedSegments = [];
      let unresolvedSegments = [];

      if (selectedMailchimpSegment && selectedMailchimpSegment !== "everyone") {
        // Use the selected segment
        segmentTarget = { segment_opts: { saved_segment_id: selectedMailchimpSegment } };
        resolvedSegments = [{ id: selectedMailchimpSegment }];
      } else {
        // Auto-resolve segments from the prompt
        const resolved = await resolveMailchimpTargets(
          mailchimpToken.accessToken,
          process.env.MAILCHIMP_DC,
          canonical
        );
        resolvedSegments = resolved.resolvedSegments;
        unresolvedSegments = resolved.unresolvedSegments;

        // Check for unresolved targets
        if (unresolvedSegments.length > 0) {
          return res.status(400).json({
            error: `Could not resolve segments: ${unresolvedSegments.join(", ")}`
          });
        }

        if (resolvedSegments.length > 0) {
          segmentTarget = { segment_opts: { saved_segment_id: resolvedSegments[0].id } };
        }
      }

      // Fetch template HTML if templateId is provided
      let templateHtml = null;
      if (templateId) {
        try {
          const templateRes = await fetch(
            `https://${process.env.MAILCHIMP_DC}.api.mailchimp.com/3.0/campaigns/${templateId}/content`,
            {
              headers: {
                "Content-Type": "application/json",
                Authorization: `Bearer ${mailchimpToken}`,
              },
            }
          );
          
          if (templateRes.ok) {
            const templateData = await templateRes.json();
            templateHtml = templateData.html;
          } else {
            console.warn('Failed to fetch template:', await templateRes.text());
          }
        } catch (error) {
          console.error('Error fetching template:', error);
        }
      }

      const { campaignPayload, contentPayload, scheduled_time } = normalizeForMailchimp(
        canonical, 
        segmentTarget,
        templateHtml
      );

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
        if (!schedRes.ok) {
          console.log('Schedule API error:', await schedRes.text());
        }
        scheduleStatus = schedRes.ok ? "scheduled_successfully" : "schedule_failed";
      }

      results.mailchimp = {
        status: scheduleStatus,
        url: `https://${process.env.MAILCHIMP_DC}.admin.mailchimp.com/campaigns/edit?id=${created.web_id}`,
        unresolvedSegments,
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

      // Add segment information for informational purposes
      let segmentInfo = null;
      if (selectedIntercomSegment && selectedIntercomSegment !== "everyone") {
        segmentInfo = { selectedSegment: selectedIntercomSegment };
      } else {
        // Try to find the best matching segment from the prompt
        try {
          const segmentsRes = await fetch(
            "https://api.intercom.io/tags",
            {
              headers: {
                Authorization: `Bearer ${intercomToken}`,
                "Content-Type": "application/json",
                Accept: "application/json",
              },
            }
          );
          
          if (segmentsRes.ok) {
            const segmentsData = await segmentsRes.json();
            const segments = segmentsData.data || [];
            
            // Simple matching logic - could be improved with fuzzy search
            const promptSegments = canonical.intercom?.audience?.segments || [];
            const matchedSegment = segments.find(segment => 
              promptSegments.some(promptSeg => 
                segment.name.toLowerCase().includes(promptSeg.toLowerCase()) ||
                promptSeg.toLowerCase().includes(segment.name.toLowerCase())
              )
            );
            
            if (matchedSegment) {
              segmentInfo = { suggestedSegment: matchedSegment.name };
            }
          }
        } catch (error) {
          console.error('Error fetching Intercom segments for info:', error);
        }
      }

      results.intercom = {
        status: "created",
        url: created.url,
        segmentInfo,
      };
    } catch (err) {
      console.error("Intercom News error:", err);
      results.intercom = { error: err.message };
    }
  }

  return res.status(200).json({ results });
}
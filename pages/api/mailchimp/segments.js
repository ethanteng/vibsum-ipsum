import { getServerSession } from "next-auth/next";
import { authOptions } from "../auth/[...nextauth]";
import { getUserMailchimpToken } from "../../../lib/getUserTokens";

export default async function handler(req, res) {
  if (req.method !== "GET") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    const session = await getServerSession(req, res, authOptions);
    if (!session) {
      return res.status(401).json({ error: "Not authenticated" });
    }

    // Get user's Mailchimp token
    const mailchimpToken = await getUserMailchimpToken(session.user.id);
    if (!mailchimpToken) {
      return res.status(400).json({ 
        error: "Mailchimp not connected. Please connect your account in Settings > Connections." 
      });
    }

    // Fetch segments from Mailchimp
    const segmentsRes = await fetch(
      `https://${process.env.MAILCHIMP_DC}.api.mailchimp.com/3.0/lists/${process.env.MAILCHIMP_LIST_ID}/segments`,
      {
        headers: {
          Authorization: `Bearer ${mailchimpToken}`,
          "Content-Type": "application/json",
        },
      }
    );

    if (!segmentsRes.ok) {
      throw new Error(`Failed to fetch segments: ${await segmentsRes.text()}`);
    }

    const segmentsData = await segmentsRes.json();
    const segments = segmentsData.segments || [];
    
    console.log("Raw Mailchimp segments response:", JSON.stringify(segmentsData, null, 2));
    console.log("Processed segments:", segments);

    // Add "Everyone" option at the beginning
    const segmentsWithEveryone = [
      { id: "everyone", name: "Everyone", member_count: segments.reduce((sum, s) => sum + (s.member_count || 0), 0) },
      ...segments
    ];

    console.log("Final segments with Everyone:", segmentsWithEveryone);
    return res.status(200).json({ segments: segmentsWithEveryone });
  } catch (error) {
    console.error("Error fetching Mailchimp segments:", error);
    return res.status(500).json({ error: error.message });
  }
} 
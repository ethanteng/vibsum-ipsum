import { getServerSession } from "next-auth/next";
import { authOptions } from "../auth/[...nextauth]";
import { getUserIntercomToken } from "../../../lib/getUserTokens";

export default async function handler(req, res) {
  if (req.method !== "GET") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    const session = await getServerSession(req, res, authOptions);
    if (!session) {
      return res.status(401).json({ error: "Not authenticated" });
    }

    // Get user's Intercom token
    const intercomToken = await getUserIntercomToken(session.user.id);
    if (!intercomToken) {
      return res.status(400).json({ 
        error: "Intercom not connected. Please connect your account in Settings > Connections." 
      });
    }

    // Fetch segments from Intercom
    const segmentsRes = await fetch(
      "https://api.intercom.io/segments",
      {
        headers: {
          Authorization: `Bearer ${intercomToken}`,
          "Content-Type": "application/json",
          Accept: "application/json",
        },
      }
    );

    if (!segmentsRes.ok) {
      throw new Error(`Failed to fetch Intercom segments: ${await segmentsRes.text()}`);
    }

    const segmentsData = await segmentsRes.json();
    // Intercom segments API returns { type: 'segment.list', segments: [...] }
    const segments = segmentsData.segments || [];

    // Add "Everyone" option at the beginning
    const segmentsWithEveryone = [
      { id: "everyone", name: "Everyone" },
      ...segments.map(segment => ({ id: segment.id, name: segment.name }))
    ];

    return res.status(200).json({ segments: segmentsWithEveryone });
  } catch (error) {
    console.error("Error fetching Intercom segments:", error);
    return res.status(500).json({ error: error.message });
  }
} 
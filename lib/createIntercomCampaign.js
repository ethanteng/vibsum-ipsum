// lib/createIntercomCampaign.js

export async function createIntercomCampaign({ canonical, apiKey, appId }) {
  // 1. Fetch all segments
  const segmentRes = await fetch("https://api.intercom.io/segments", {
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`
    }
  });

  if (!segmentRes.ok) {
    throw new Error(`Failed to fetch segments: ${await segmentRes.text()}`);
  }

  const segmentData = await segmentRes.json();
  console.log("RAW segment response:", JSON.stringify(segmentData, null, 2));
  const allSegments = (segmentData.segments || []).filter(s => s.type === "segment");

  // Keep only user segments
  const userSegments = allSegments.filter(s => s.person_type === "user");

  // 2. Resolve segment IDs robustly
  const resolvedSegmentIds = [];
  const unresolvedSegments = [];

  for (const name of canonical.intercom.audience?.segments || []) {
    const normalizedName = name.trim().toLowerCase();
    const match = userSegments.find(
      s => s.name.trim().toLowerCase() === normalizedName
    );

    if (match) {
      resolvedSegmentIds.push(match.id);
    } else {
      unresolvedSegments.push(name);
    }
  }

  if (unresolvedSegments.length > 0) {
    console.error(
      `Intercom segment(s) not found: ${unresolvedSegments.join(", ")}`
    );
  console.error(
    "Available segments (all types):",
    allSegments.map(s => `${s.name} (person_type: ${s.person_type})`).join(", ")
  );
    throw new Error(`Intercom segment(s) not found: ${unresolvedSegments.join(", ")}`);
  }

  // 3. Prepare payload
  const messagePayload = {
    message_type: "inapp",
    template: "plain",
    body: canonical.intercom.in_app_message,
    audience: {
      ids: resolvedSegmentIds
    }
  };

  // 4. Create the message
  const createRes = await fetch("https://api.intercom.io/messages", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`
    },
    body: JSON.stringify(messagePayload)
  });

  if (!createRes.ok) {
    throw new Error(`Intercom create error: ${await createRes.text()}`);
  }

  const created = await createRes.json();

  // 5. Return useful metadata
  return {
    id: created.id,
    url: `https://app.intercom.com/a/apps/${appId}/outbound/messages/${created.id}`
  };
}
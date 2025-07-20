import Fuse from 'fuse.js';

export async function resolveMailchimpTargets(apiKey, serverPrefix, canonical) {
  // 1. Fetch segments using API key (not OAuth token)
  const segmentRes = await fetch(`https://${serverPrefix}.api.mailchimp.com/3.0/lists/${process.env.MAILCHIMP_LIST_ID}/segments`, {
    headers: { 
      Authorization: `apikey ${process.env.MAILCHIMP_API_KEY}`,
      'Content-Type': 'application/json'
    }
  });
  
  if (!segmentRes.ok) throw new Error(`Failed to fetch segments: ${await segmentRes.text()}`);
  
  const segmentData = await segmentRes.json();
  const allSegments = segmentData.segments || [];
  
  // 3. Fuzzy search setup for segments
  const segmentFuse = new Fuse(allSegments, { keys: ["name"], threshold: 0.4 });
  
  // 4. Resolve segments
  const resolvedSegments = [];
  const unresolvedSegments = [];
  
  for (const name of canonical.mailchimp.audience?.segments || []) {
    // Try exact match first
    const exact = allSegments.find(s => s.name.toLowerCase() === name.toLowerCase());
    
    if (exact) {
      resolvedSegments.push({ id: exact.id, name: exact.name });
    } else {
      // Try fuzzy match
      const fuzzy = segmentFuse.search(name);
      if (fuzzy.length > 0) {
        resolvedSegments.push({ id: fuzzy[0].item.id, name: fuzzy[0].item.name });
      } else {
        unresolvedSegments.push(name);
      }
    }
  }

  return { resolvedSegments, unresolvedSegments };
}
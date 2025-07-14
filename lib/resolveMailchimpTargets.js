import Fuse from "fuse.js";

export async function resolveMailchimpTargets({ segmentNames = [], tagNames = [] }) {
  const apiBase = `https://${process.env.MAILCHIMP_DC}.api.mailchimp.com/3.0`;
  const authHeaders = {
    "Content-Type": "application/json",
    Authorization: `apikey ${process.env.MAILCHIMP_API_KEY}`,
  };

  // 1. Fetch segments
  const segRes = await fetch(`${apiBase}/lists/${process.env.MAILCHIMP_LIST_ID}/segments`, { headers: authHeaders });
  if (!segRes.ok) throw new Error(`Failed to fetch segments: ${await segRes.text()}`);
  const segData = await segRes.json();
  const allSegments = segData.segments || [];

  // 2. Fetch tags
  const tagRes = await fetch(`${apiBase}/lists/${process.env.MAILCHIMP_LIST_ID}/tag-search`, { headers: authHeaders });
  if (!tagRes.ok) throw new Error(`Failed to fetch tags: ${await tagRes.text()}`);
  const tagData = await tagRes.json();
  const allTags = tagData.tags || [];

  // 3. Setup Fuse for fuzzy matching
  const segFuse = new Fuse(allSegments, { keys: ["name"], threshold: 0.4 });
  const tagFuse = new Fuse(allTags, { keys: ["name"], threshold: 0.4 });

  const resolvedSegments = [];
  const resolvedTags = [];

  // 4. Resolve segments
  for (const name of segmentNames) {
    const exact = allSegments.find(s => s.name.toLowerCase() === name.toLowerCase());
    if (exact) {
      resolvedSegments.push({ id: exact.id, name: exact.name });
    } else {
      const fuzzy = segFuse.search(name);
      if (fuzzy.length > 0) {
        const match = fuzzy[0].item;
        resolvedSegments.push({ id: match.id, name: match.name });
      } else {
        throw new Error(`Segment "${name}" not found.`);
      }
    }
  }

  // 5. Resolve tags
  for (const name of tagNames) {
    const exact = allTags.find(t => t.name.toLowerCase() === name.toLowerCase());
    if (exact) {
      resolvedTags.push({ name: exact.name });
    } else {
      const fuzzy = tagFuse.search(name);
      if (fuzzy.length > 0) {
        const match = fuzzy[0].item;
        resolvedTags.push({ name: match.name });
      } else {
        throw new Error(`Tag "${name}" not found.`);
      }
    }
  }

  return { resolvedSegments, resolvedTags };
}

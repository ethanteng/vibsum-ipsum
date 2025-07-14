import Fuse from "fuse.js";

/**
 * Resolves Mailchimp segment and tag names to IDs/names.
 * Returns both resolved and unresolved entries.
 */
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

  // 3. Setup fuzzy matching
  const segFuse = new Fuse(allSegments, { keys: ["name"], threshold: 0.4 });
  const tagFuse = new Fuse(allTags, { keys: ["name"], threshold: 0.4 });

  const resolvedSegments = [];
  const unresolvedSegments = [];
  const resolvedTags = [];
  const unresolvedTags = [];

  // 4. Resolve segments
  for (const name of segmentNames) {
    const exact = allSegments.find(s => s.name.toLowerCase() === name.toLowerCase());
    if (exact) {
      resolvedSegments.push({ id: exact.id, name: exact.name });
    } else {
      const fuzzy = segFuse.search(name);
      if (fuzzy.length > 0) {
        resolvedSegments.push({ id: fuzzy[0].item.id, name: fuzzy[0].item.name });
      } else {
        unresolvedSegments.push(name);
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
        resolvedTags.push({ name: fuzzy[0].item.name });
      } else {
        unresolvedTags.push(name);
      }
    }
  }

  return { resolvedSegments, resolvedTags, unresolvedSegments, unresolvedTags };
}
import { PrismaClient } from '@prisma/client';
import { generateEmbedding } from './embedding.js';

const prisma = new PrismaClient();

export async function ingestMailchimpCampaigns(userId, campaigns) {
  for (const campaign of campaigns) {
    const text = `${campaign.subject}\n${campaign.body}`;
    const embedding = await generateEmbedding(text);
    await prisma.mailchimpContent.upsert({
      where: { campaignId: campaign.id },
      update: {},
      create: {
        userId,
        campaignId: campaign.id,
        subject: campaign.subject,
        body: campaign.body,
        sentAt: new Date(campaign.sentAt),
        embedding: Buffer.from(Float32Array.from(embedding).buffer),
      },
    });
  }
}

export async function ingestIntercomContent(userId, items) {
  for (const item of items) {
    const text = `${item.title}\n${item.body}`;
    const embedding = await generateEmbedding(text);
    await prisma.intercomContent.upsert({
      where: { contentId: item.id },
      update: {},
      create: {
        userId,
        contentId: item.id,
        title: item.title,
        body: item.body,
        sentAt: new Date(item.sentAt),
        embedding: Buffer.from(Float32Array.from(embedding).buffer),
      },
    });
  }
}

// Utility: Check if ingestion is needed (older than 1 day)
export async function isIngestionNeeded(userId) {
  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user || !user.lastIngestedAt) return true;
  const oneDay = 24 * 60 * 60 * 1000;
  return (Date.now() - new Date(user.lastIngestedAt).getTime()) > oneDay;
}

// Utility: Update lastIngestedAt
export async function updateLastIngestedAt(userId) {
  await prisma.user.update({ where: { id: userId }, data: { lastIngestedAt: new Date() } });
}

// Utility: Ingest for all users whose data is stale (older than 1 hour)
export async function ingestForAllStaleUsers() {
  const oneHour = 60 * 60 * 1000;
  const now = Date.now();
  const users = await prisma.user.findMany();
  for (const user of users) {
    if (!user.lastIngestedAt || (now - new Date(user.lastIngestedAt).getTime()) > oneHour) {
      // You can reuse the ingestion logic by calling the /api/admin/ingest endpoint for each user,
      // or refactor the ingestion logic into a shared function and call it here directly.
      // For now, just log the user id (replace with real ingestion call).
      // await ingestUserContent(user.id); // You can implement this if you want direct ingestion
      // Or trigger the API route with a server-side fetch if running in a server context
      console.log(`Would ingest for user: ${user.id}`);
    }
  }
}

// Usage example (to be replaced with real API fetches):
// (async () => {
//   await ingestMailchimpCampaigns('user-id', [
//     { id: 'c1', subject: 'Subject 1', body: 'Body 1', sentAt: '2024-07-23T00:00:00Z' },
//   ]);
//   await ingestIntercomContent('user-id', [
//     { id: 'i1', title: 'Title 1', body: 'Body 1', sentAt: '2024-07-23T00:00:00Z' },
//   ]);
// })(); 
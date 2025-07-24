import { getServerSession } from 'next-auth/next';
import { authOptions } from '../auth/[...nextauth]';
import { ingestMailchimpCampaigns, ingestIntercomContent, isIngestionNeeded, updateLastIngestedAt } from '../../../lib/ingestContent.js';
import { getUserMailchimpToken, getUserIntercomToken } from '../../../lib/getUserTokens.js';

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
  const session = await getServerSession(req, res, authOptions);
  if (!session?.user?.id) return res.status(401).json({ error: 'Unauthorized' });
  const userId = session.user.id;
  try {
    let logs = [];
    // Mailchimp
    const mailchimpToken = await getUserMailchimpToken(userId);
    if (mailchimpToken) {
      logs.push('Fetching Mailchimp campaigns...');
      const campaignsRes = await fetch(
        `https://${process.env.MAILCHIMP_DC}.api.mailchimp.com/3.0/campaigns?count=50&status=sent`,
        {
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${mailchimpToken}`,
          },
        }
      );
      if (!campaignsRes.ok) throw new Error(`Failed to fetch campaigns: ${await campaignsRes.text()}`);
      const campaignsData = await campaignsRes.json();
      logs.push(`Raw Mailchimp campaigns response: ${JSON.stringify(campaignsData).slice(0, 1000)}`);
      const campaigns = campaignsData.campaigns || [];
      // For each campaign, fetch its content
      const campaignsWithContent = await Promise.all(
        campaigns.map(async (campaign) => {
          try {
            const contentRes = await fetch(
              `https://${process.env.MAILCHIMP_DC}.api.mailchimp.com/3.0/campaigns/${campaign.id}/content`,
              {
                headers: {
                  'Content-Type': 'application/json',
                  Authorization: `Bearer ${mailchimpToken}`,
                },
              }
            );
            if (!contentRes.ok) return null;
            const contentData = await contentRes.json();
            logs.push(`Mailchimp campaign ${campaign.id} content: ${JSON.stringify(contentData).slice(0, 500)}`);
            return {
              id: campaign.id,
              subject: campaign.settings?.subject_line || '',
              body: contentData.html || '',
              sentAt: campaign.send_time || new Date().toISOString(),
            };
          } catch (err) {
            logs.push(`Error fetching content for campaign ${campaign.id}: ${err.message}`);
            return null;
          }
        })
      );
      const validCampaigns = campaignsWithContent.filter(c => c && c.body);
      logs.push(`Ingesting ${validCampaigns.length} Mailchimp campaigns...`);
      await ingestMailchimpCampaigns(userId, validCampaigns);
      logs.push('Mailchimp ingestion complete.');
    } else {
      logs.push('No Mailchimp token found. Skipping Mailchimp ingestion.');
    }
    // Intercom
    const intercomToken = await getUserIntercomToken(userId);
    if (intercomToken) {
      logs.push('Fetching Intercom news items...');
      // Fetch news items from the correct endpoint
      const newsRes = await fetch('https://api.intercom.io/news/news_items', {
        headers: {
          Authorization: `Bearer ${intercomToken}`,
          'Content-Type': 'application/json',
          Accept: 'application/json',
          'Intercom-Version': '2.13',
        },
      });
      let newsItems = [];
      if (newsRes.ok) {
        const newsData = await newsRes.json();
        logs.push(`Raw Intercom news_items response: ${JSON.stringify(newsData).slice(0, 1000)}`);
        newsItems = (newsData.data || []).map(n => ({
          id: n.id,
          title: n.title,
          body: n.body,
          sentAt: n.published_at ? new Date(n.published_at * 1000).toISOString() : new Date().toISOString(),
        }));
      } else {
        logs.push(`Failed to fetch Intercom news_items: ${newsRes.status}`);
      }
      // Optionally, fetch outbound messages (posts, emails) as before
      const outboundRes = await fetch('https://api.intercom.io/messages/outbound', {
        headers: {
          Authorization: `Bearer ${intercomToken}`,
          'Content-Type': 'application/json',
          Accept: 'application/json',
        },
      });
      let outboundItems = [];
      if (outboundRes.ok) {
        const outboundData = await outboundRes.json();
        logs.push(`Raw Intercom outbound response: ${JSON.stringify(outboundData).slice(0, 1000)}`);
        outboundItems = (outboundData.messages || [])
          .filter(m => m.message_type === 'email' || m.message_type === 'post')
          .map(m => ({
            id: m.id,
            title: m.subject || m.title || '',
            body: m.body || m.content?.body || '',
            sentAt: m.created_at ? new Date(m.created_at * 1000).toISOString() : new Date().toISOString(),
          }));
      } else {
        logs.push(`Failed to fetch Intercom outbound messages: ${outboundRes.status}`);
      }
      const allItems = [...newsItems, ...outboundItems];
      logs.push(`Ingesting ${allItems.length} Intercom items...`);
      await ingestIntercomContent(userId, allItems);
      logs.push('Intercom ingestion complete.');
    } else {
      logs.push('No Intercom token found. Skipping Intercom ingestion.');
    }
    await updateLastIngestedAt(userId);
    logs.push('Ingestion complete.');
    res.status(200).json({ status: 'Ingestion complete', logs });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
} 
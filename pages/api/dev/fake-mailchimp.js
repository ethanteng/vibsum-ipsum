import { getServerSession } from 'next-auth/next';
import { authOptions } from '../auth/[...nextauth]';
import { getUserMailchimpToken } from '../../../lib/getUserTokens';
import { faker } from '@faker-js/faker';

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
  const session = await getServerSession(req, res, authOptions);
  if (!session || session.user.email !== 'ethan+vybescript@ethanteng.com') {
    return res.status(401).json({ error: 'Unauthorized' });
  }
  const { subscribers = 5, campaigns = 2 } = req.body || {};
  try {
    const mailchimpToken = await getUserMailchimpToken(session.user.id);
    if (!mailchimpToken) return res.status(400).json({ error: 'Mailchimp not connected' });
    const serverPrefix = process.env.MAILCHIMP_DC;
    const listId = process.env.MAILCHIMP_LIST_ID;
    if (!listId) return res.status(400).json({ error: 'MAILCHIMP_LIST_ID not set' });
    const created = { subscribers: [], campaigns: [] };
    // Create fake subscribers
    for (let i = 0; i < subscribers; ++i) {
      const email = faker.internet.email();
      const url = `https://${serverPrefix}.api.mailchimp.com/3.0/lists/${listId}/members`;
      const resp = await fetch(url, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${mailchimpToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          email_address: email,
          status: 'subscribed',
          merge_fields: { FNAME: faker.person.firstName(), LNAME: faker.person.lastName() },
        }),
      });
      const data = await resp.json();
      created.subscribers.push({ email, status: data.status });
    }
    // Create fake campaigns
    for (let i = 0; i < campaigns; ++i) {
      const subject = faker.company.catchPhrase();
      const body = faker.lorem.paragraphs(2);
      const campaignUrl = `https://${serverPrefix}.api.mailchimp.com/3.0/campaigns`;
      const campaignResp = await fetch(campaignUrl, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${mailchimpToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          type: 'regular',
          recipients: { list_id: listId },
          settings: {
            subject_line: subject,
            title: subject,
            from_name: 'Vybescript Dev',
            reply_to: 'no-reply@vybescript.com',
          },
        }),
      });
      const campaignData = await campaignResp.json();
      // Set campaign content
      if (campaignData.id) {
        const contentUrl = `https://${serverPrefix}.api.mailchimp.com/3.0/campaigns/${campaignData.id}/content`;
        await fetch(contentUrl, {
          method: 'PUT',
          headers: {
            'Authorization': `Bearer ${mailchimpToken}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ html: `<h1>${subject}</h1><p>${body}</p>` }),
        });
      }
      created.campaigns.push({ id: campaignData.id, subject });
    }
    res.status(200).json({ success: true, created });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
} 
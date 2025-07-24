import { getServerSession } from 'next-auth/next';
import { authOptions } from '../auth/[...nextauth]';
import { getUserIntercomToken } from '../../../lib/getUserTokens';
import { faker } from '@faker-js/faker';

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
  const session = await getServerSession(req, res, authOptions);
  if (!session || session.user.email !== 'ethan+vybescript@ethanteng.com') {
    return res.status(401).json({ error: 'Unauthorized' });
  }
  const { users = 5, conversations = 2 } = req.body || {};
  try {
    const intercomToken = await getUserIntercomToken(session.user.id);
    if (!intercomToken) return res.status(400).json({ error: 'Intercom not connected' });
    const created = { users: [], conversations: [] };
    let userPool = [];
    if (users > 0) {
      // Create fake users
      for (let i = 0; i < users; ++i) {
        const email = faker.internet.email();
        const userRes = await fetch('https://api.intercom.io/contacts', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${intercomToken}`,
            'Content-Type': 'application/json',
            'Accept': 'application/json',
          },
          body: JSON.stringify({
            email,
            role: 'user',
            name: faker.person.fullName(),
          }),
        });
        const userData = await userRes.json();
        created.users.push({ email, id: userData.id });
      }
      userPool = created.users;
    } else {
      // Fetch existing users from Intercom
      const usersRes = await fetch('https://api.intercom.io/contacts?role=user', {
        headers: {
          'Authorization': `Bearer ${intercomToken}`,
          'Accept': 'application/json',
        },
      });
      const usersData = await usersRes.json();
      userPool = (usersData.data || []).map(u => ({ id: u.id, email: u.email }));
      if (userPool.length === 0) {
        return res.status(400).json({ error: 'No existing users found in Intercom.' });
      }
    }
    // Create fake conversations using the /conversations API
    for (let i = 0; i < conversations; ++i) {
      // Pick a random user from the pool
      const user = userPool[Math.floor(Math.random() * userPool.length)];
      const message = faker.lorem.sentences(2);
      const convRes = await fetch('https://api.intercom.io/conversations', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${intercomToken}`,
          'Content-Type': 'application/json',
          'Accept': 'application/json',
        },
        body: JSON.stringify({
          from: { type: 'admin', id: '8548749' }, // Replace with your admin ID if needed
          to: { type: 'user', id: user.id },
          body: message,
        }),
      });
      const convData = await convRes.json();
      created.conversations.push({ user: user.email, id: convData.id, response: convData });
    }
    res.status(200).json({ success: true, created });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
} 
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
  const {
    users = 5,
    conversations = 2,
    companies = 2,
    segments = 2,
    events = 2,
    notes = 2,
    articles = 2,
    news = 2,
  } = req.body || {};
  try {
    const intercomToken = await getUserIntercomToken(session.user.id);
    if (!intercomToken) return res.status(400).json({ error: 'Intercom not connected' });
    const created = { users: [], conversations: [], companies: [], segments: [], events: [], notes: [], articles: [], news: [] };
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
        console.log('User creation response:', userData); // Log user creation
        if (!userRes.ok || !userData.id) {
          console.error('Failed to create user:', userData);
          return res.status(500).json({ error: 'Failed to create user', details: userData });
        }
        created.users.push({ email, id: userData.id });
      }
      // Poll Intercom API for expected number of users (up to 60s)
      let pollAttempts = 0;
      let fetchedUsers = [];
      const pollMax = 30; // 2s * 30 = 60s
      while (pollAttempts < pollMax) {
        const usersRes = await fetch('https://api.intercom.io/contacts?role=user', {
          headers: {
            'Authorization': `Bearer ${intercomToken}`,
            'Accept': 'application/json',
          },
        });
        const usersData = await usersRes.json();
        fetchedUsers = (usersData.data || []).map(u => ({ id: u.id, email: u.email }));
        console.log(`Polling Intercom: found ${fetchedUsers.length} users (attempt ${pollAttempts + 1})`);
        if (fetchedUsers.length >= users) break;
        await new Promise(r => setTimeout(r, 2000));
        pollAttempts++;
      }
      if (fetchedUsers.length < users) {
        console.warn(`Warning: Only ${fetchedUsers.length} users found after polling, expected ${users}`);
      }
      userPool = fetchedUsers;
      console.log('Final userPool for events/notes:', userPool.length);
    } else {
      // Fetch existing users from Intercom
      const usersRes = await fetch('https://api.intercom.io/contacts?role=user', {
        headers: {
          'Authorization': `Bearer ${intercomToken}`,
          'Accept': 'application/json',
        },
      });
      const usersData = await usersRes.json();
      console.log('Fetched existing users:', usersData); // Log existing users
      userPool = (usersData.data || []).map(u => ({ id: u.id, email: u.email }));
      if (userPool.length === 0) {
        // No users exist, create one
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
        console.log('Fallback user creation response:', userData); // Log fallback user
        if (!userRes.ok || !userData.id) {
          console.error('Failed to create fallback user:', userData);
          return res.status(500).json({ error: 'Failed to create fallback user', details: userData });
        }
        created.users.push({ email, id: userData.id });
        userPool = [{ id: userData.id, email }];
      }
    }
    // Log userPool before proceeding
    console.log('User pool before events/notes:', userPool.length, userPool);
    // Delay after user creation to allow Intercom to index users
    console.log('Waiting 7 seconds for Intercom to index users...');
    await new Promise(r => setTimeout(r, 7000));
    // Companies and associate users
    for (let i = 0; i < companies; ++i) {
      const name = faker.company.name();
      const companyRes = await fetch('https://api.intercom.io/companies', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${intercomToken}`,
          'Content-Type': 'application/json',
          'Accept': 'application/json',
        },
        body: JSON.stringify({
          name,
          company_id: faker.string.uuid(),
          website: faker.internet.url(),
        }),
      });
      const companyData = await companyRes.json();
      // Associate a random user with this company
      const user = userPool[Math.floor(Math.random() * userPool.length)];
      if (user) {
        await fetch(`https://api.intercom.io/contacts/${user.id}/companies`, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${intercomToken}`,
            'Content-Type': 'application/json',
            'Accept': 'application/json',
          },
          body: JSON.stringify({ companies: [{ id: companyData.id }] }),
        });
      }
      created.companies.push({ id: companyData.id, name });
    }
    // Segments (tags)
    for (let i = 0; i < segments; ++i) {
      const name = `Dev Segment ${faker.word.adjective()} ${faker.word.noun()} ${faker.number.int({ min: 1, max: 1000 })}`;
      const tagRes = await fetch('https://api.intercom.io/tags', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${intercomToken}`,
          'Content-Type': 'application/json',
          'Accept': 'application/json',
        },
        body: JSON.stringify({ name }),
      });
      const tagData = await tagRes.json();
      // Tag a random user
      const user = userPool[Math.floor(Math.random() * userPool.length)];
      if (user) {
        await fetch('https://api.intercom.io/tags', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${intercomToken}`,
            'Content-Type': 'application/json',
            'Accept': 'application/json',
          },
          body: JSON.stringify({
            name,
            users: [{ id: user.id }],
          }),
        });
      }
      created.segments.push({ id: tagData.id, name });
    }
    // Events for users
    for (let i = 0; i < events; ++i) {
      const user = userPool[Math.floor(Math.random() * userPool.length)];
      const eventName = `dev_event_${faker.word.verb()}_${faker.number.int({ min: 1, max: 1000 })}`;
      let eventData, eventRes, attempt = 0;
      let success = false;
      while (attempt < 3 && !success) {
        eventRes = await fetch(`https://api.intercom.io/events`, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${intercomToken}`,
            'Content-Type': 'application/json',
            'Accept': 'application/json',
          },
          body: JSON.stringify({
            event_name: eventName,
            created_at: Math.floor(Date.now() / 1000),
            user_id: user.id,
            metadata: { foo: faker.word.noun() },
          }),
        });
        eventData = await eventRes.json();
        console.log(`Event creation attempt ${attempt + 1} for user ${user.id}:`, eventData);
        if (eventRes.ok && !eventData.errors) {
          success = true;
        } else if (eventData.errors && eventData.errors.some(e => e.message && e.message.includes('User Not Found'))) {
          attempt++;
          if (attempt < 3) {
            console.warn('User Not Found for event, retrying in 2s...');
            await new Promise(r => setTimeout(r, 2000));
          }
        } else {
          break;
        }
      }
      created.events.push({ user: user.email, event: eventName, response: eventData });
    }
    // Notes for users
    for (let i = 0; i < notes; ++i) {
      const user = userPool[Math.floor(Math.random() * userPool.length)];
      const note = faker.lorem.sentences(2);
      let noteData, noteRes, attempt = 0;
      let success = false;
      while (attempt < 3 && !success) {
        noteRes = await fetch(`https://api.intercom.io/notes`, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${intercomToken}`,
            'Content-Type': 'application/json',
            'Accept': 'application/json',
          },
          body: JSON.stringify({
            body: note,
            // Per Intercom docs, use 'user_id' at top level for notes
            user_id: user.id,
          }),
        });
        noteData = await noteRes.json();
        console.log(`Note creation attempt ${attempt + 1} for user ${user.id}:`, noteData);
        if (noteRes.ok && !noteData.errors) {
          success = true;
        } else if (noteData.errors && noteData.errors.some(e => e.message && e.message.includes('User Not Found'))) {
          attempt++;
          if (attempt < 3) {
            console.warn('User Not Found for note, retrying in 2s...');
            await new Promise(r => setTimeout(r, 2000));
          }
        } else {
          break;
        }
      }
      created.notes.push({ user: user.email, note, response: noteData });
    }
    // Articles
    for (let i = 0; i < articles; ++i) {
      const title = faker.company.catchPhrase();
      const body = faker.lorem.paragraphs(2);
      const articleRes = await fetch('https://api.intercom.io/articles', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${intercomToken}`,
          'Content-Type': 'application/json',
          'Accept': 'application/json',
        },
        body: JSON.stringify({
          title,
          body,
          author_id: 8548749, // Use admin user id for author
          state: 'published',
        }),
      });
      const articleData = await articleRes.json();
      created.articles.push({ id: articleData.id, title, response: articleData });
    }
    // News items
    for (let i = 0; i < news; ++i) {
      const title = faker.company.catchPhrase();
      const body = faker.lorem.paragraphs(2);
      const newsRes = await fetch('https://api.intercom.io/news/news_items', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${intercomToken}`,
          'Content-Type': 'application/json',
          'Accept': 'application/json',
        },
        body: JSON.stringify({
          title,
          body,
          state: 'live', // Use valid state
          sender_id: 8548749, // Use admin user id for sender
        }),
      });
      const newsData = await newsRes.json();
      created.news.push({ id: newsData.id, title, response: newsData });
    }
    // Conversations
    for (let i = 0; i < conversations; ++i) {
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
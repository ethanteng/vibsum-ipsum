import { getSession } from 'next-auth/react';

export default async function handler(req, res) {
  const session = await getSession({ req });
  
  if (!session) {
    return res.status(401).json({ error: 'Not authenticated' });
  }

  if (req.method === 'GET') {
    // Step 1: Redirect to Mailchimp OAuth
    const clientId = process.env.MAILCHIMP_CLIENT_ID;
    const redirectUri = 'http://127.0.0.1:3000/api/mailchimp/callback';
    const scope = 'campaigns:read campaigns:write';
    
    const authUrl = `https://login.mailchimp.com/oauth2/authorize?` +
      `client_id=${clientId}&` +
      `response_type=code&` +
      `scope=${encodeURIComponent(scope)}&` +
      `redirect_uri=${encodeURIComponent(redirectUri)}&` +
      `state=${session.user.id}`; // Use user ID as state for security
    
    res.redirect(authUrl);
  } else {
    res.setHeader('Allow', ['GET']);
    res.status(405).end(`Method ${req.method} Not Allowed`);
  }
} 
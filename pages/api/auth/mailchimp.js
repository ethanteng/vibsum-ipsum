import { getServerSession } from 'next-auth/next';
import { authOptions } from './[...nextauth]';

export default async function handler(req, res) {
  const session = await getServerSession(req, res, authOptions);
  
  if (!session) {
    return res.status(401).json({ error: 'Not authenticated' });
  }

  if (req.method === 'GET') {
    // Step 1: Redirect to Mailchimp OAuth
    const isProduction = process.env.NODE_ENV === 'production';
    const clientId = isProduction 
      ? process.env.MAILCHIMP_CLIENT_ID_PROD || process.env.MAILCHIMP_CLIENT_ID
      : process.env.MAILCHIMP_CLIENT_ID_DEV || process.env.MAILCHIMP_CLIENT_ID;
    
    // Use 127.0.0.1 for development (Mailchimp requirement)
    const baseUrl = isProduction 
      ? (process.env.NEXTAUTH_URL || 'https://app.vybescript.com')
      : 'http://127.0.0.1:3000';
    const redirectUri = `${baseUrl}/api/mailchimp/callback`;
    const scope = 'campaigns:read campaigns:write';
    
    console.log('Mailchimp OAuth Debug:', {
      isProduction,
      clientId: clientId ? 'SET' : 'NOT_SET',
      baseUrl,
      redirectUri,
      NEXTAUTH_URL: process.env.NEXTAUTH_URL
    });
    
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
import { getSession } from 'next-auth/react';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

export default async function handler(req, res) {
  const { code, state, error } = req.query;
  
  console.log('Mailchimp callback received:', { code: !!code, state, error, url: req.url });
  
  // Determine the correct redirect URL
  const isProduction = process.env.NODE_ENV === 'production';
  const redirectBaseUrl = isProduction 
    ? (process.env.NEXTAUTH_URL || 'https://app.vybescript.com')
    : 'http://localhost:3000';
  
  if (error) {
    console.error('Mailchimp OAuth error:', error);
    return res.redirect(`${redirectBaseUrl}/connections?error=mailchimp_oauth_failed`);
  }

  if (!code || !state) {
    console.error('Missing code or state:', { code: !!code, state });
    return res.redirect(`${redirectBaseUrl}/connections?error=mailchimp_invalid_response`);
  }

  try {
    // Step 2: Exchange code for access token
    const isProduction = process.env.NODE_ENV === 'production';
    const clientId = isProduction 
      ? process.env.MAILCHIMP_CLIENT_ID_PROD || process.env.MAILCHIMP_CLIENT_ID
      : process.env.MAILCHIMP_CLIENT_ID_DEV || process.env.MAILCHIMP_CLIENT_ID;
    const clientSecret = isProduction
      ? process.env.MAILCHIMP_CLIENT_SECRET_PROD || process.env.MAILCHIMP_CLIENT_SECRET
      : process.env.MAILCHIMP_CLIENT_SECRET_DEV || process.env.MAILCHIMP_CLIENT_SECRET;
    
    // Use 127.0.0.1 for development (Mailchimp requirement)
    const baseUrl = isProduction 
      ? (process.env.NEXTAUTH_URL || 'https://app.vybescript.com')
      : 'http://127.0.0.1:3000';
    const redirectUri = `${baseUrl}/api/mailchimp/callback`;
    
    console.log('Mailchimp Token Exchange Debug:', {
      isProduction,
      clientId: clientId ? 'SET' : 'NOT_SET',
      clientSecret: clientSecret ? 'SET' : 'NOT_SET',
      baseUrl,
      redirectUri,
      NEXTAUTH_URL: process.env.NEXTAUTH_URL
    });
    
    const tokenResponse = await fetch('https://login.mailchimp.com/oauth2/token', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({
        grant_type: 'authorization_code',
        client_id: clientId,
        client_secret: clientSecret,
        code: code,
        redirect_uri: redirectUri,
      }),
    });

    if (!tokenResponse.ok) {
      const errorText = await tokenResponse.text();
      console.error('Token exchange failed:', errorText);
      return res.redirect(`${redirectBaseUrl}/connections?error=mailchimp_token_exchange_failed`);
    }

    const tokenData = await tokenResponse.json();
    console.log('Token exchange successful');
    
    // Step 3: Get user info from Mailchimp
    const userInfoResponse = await fetch('https://login.mailchimp.com/oauth2/metadata', {
      headers: {
        'Authorization': `Bearer ${tokenData.access_token}`,
      },
    });

    if (!userInfoResponse.ok) {
      console.error('User info fetch failed');
      return res.redirect(`${redirectBaseUrl}/connections?error=mailchimp_user_info_failed`);
    }

    const userInfo = await userInfoResponse.json();
    console.log('User info fetched successfully');

    // Step 4: Store tokens in database
    await prisma.mailchimpToken.upsert({
      where: { userId: state },
      update: {
        accessToken: tokenData.access_token,
        refreshToken: tokenData.refresh_token,
        expiresAt: tokenData.expires_in ? new Date(Date.now() + tokenData.expires_in * 1000) : null,
      },
      create: {
        userId: state,
        accessToken: tokenData.access_token,
        refreshToken: tokenData.refresh_token,
        expiresAt: tokenData.expires_in ? new Date(Date.now() + tokenData.expires_in * 1000) : null,
      },
    });

    console.log('Mailchimp OAuth successful for user:', state);
    res.redirect(`${redirectBaseUrl}/connections?success=mailchimp_connected`);

  } catch (error) {
    console.error('Mailchimp OAuth callback error:', error);
    res.redirect(`${redirectBaseUrl}/connections?error=mailchimp_oauth_error`);
  }
} 
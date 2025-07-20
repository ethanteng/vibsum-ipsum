import { getSession } from 'next-auth/react';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

export default async function handler(req, res) {
  const { code, state, error } = req.query;
  
  console.log('Intercom callback received:', { code: !!code, state, error, url: req.url });
  
  // Determine the correct redirect URL
  const isProduction = process.env.NODE_ENV === 'production';
  const redirectBaseUrl = isProduction 
    ? (process.env.NEXTAUTH_URL || 'https://app.vybescript.com')
    : 'http://localhost:3000';
  
  if (error) {
    console.error('Intercom OAuth error:', error);
    return res.redirect(`${redirectBaseUrl}/connections?error=intercom_oauth_failed`);
  }

  if (!code || !state) {
    console.error('Missing code or state:', { code: !!code, state });
    return res.redirect(`${redirectBaseUrl}/connections?error=intercom_invalid_response`);
  }

  try {
    // Step 2: Exchange code for access token
    const baseUrl = process.env.NEXTAUTH_URL || 'http://localhost:3000';
    const redirectUri = `${baseUrl}/api/intercom/callback`;
    
    const tokenResponse = await fetch('https://api.intercom.io/auth/eagle/token', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({
        grant_type: 'authorization_code',
        client_id: process.env.INTERCOM_CLIENT_ID,
        client_secret: process.env.INTERCOM_CLIENT_SECRET,
        code: code,
        redirect_uri: redirectUri,
      }),
    });

    if (!tokenResponse.ok) {
      const errorText = await tokenResponse.text();
      console.error('Token exchange failed:', errorText);
      return res.redirect(`${redirectBaseUrl}/connections?error=intercom_token_exchange_failed`);
    }

    const tokenData = await tokenResponse.json();
    console.log('Token exchange successful');
    
    // Step 3: Get user info from Intercom
    const userInfoResponse = await fetch('https://api.intercom.io/me', {
      headers: {
        'Authorization': `Bearer ${tokenData.access_token}`,
      },
    });

    if (!userInfoResponse.ok) {
      console.error('User info fetch failed');
      return res.redirect(`${redirectBaseUrl}/connections?error=intercom_user_info_failed`);
    }

    const userInfo = await userInfoResponse.json();
    console.log('User info fetched successfully');

    // Step 4: Store tokens in database
    await prisma.intercomToken.upsert({
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

    console.log('Intercom OAuth successful for user:', state);
    res.redirect(`${redirectBaseUrl}/connections?success=intercom_connected`);

  } catch (error) {
    console.error('Intercom OAuth callback error:', error);
    res.redirect(`${redirectBaseUrl}/connections?error=intercom_oauth_error`);
  }
} 
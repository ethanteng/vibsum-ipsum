import { getSession } from 'next-auth/react';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

export default async function handler(req, res) {
  const { code, state, error } = req.query;
  
  console.log('Mailchimp callback received:', { code: !!code, state, error, url: req.url });
  
  if (error) {
    console.error('Mailchimp OAuth error:', error);
    return res.redirect('/connections?error=mailchimp_oauth_failed');
  }

  if (!code || !state) {
    console.error('Missing code or state:', { code: !!code, state });
    return res.redirect('/connections?error=mailchimp_invalid_response');
  }

  try {
    // Step 2: Exchange code for access token
    const tokenResponse = await fetch('https://login.mailchimp.com/oauth2/token', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({
        grant_type: 'authorization_code',
        client_id: process.env.MAILCHIMP_CLIENT_ID,
        client_secret: process.env.MAILCHIMP_CLIENT_SECRET,
        code: code,
        redirect_uri: 'http://127.0.0.1:3000/api/mailchimp/callback',
      }),
    });

    if (!tokenResponse.ok) {
      const errorText = await tokenResponse.text();
      console.error('Token exchange failed:', errorText);
      return res.redirect('/connections?error=mailchimp_token_exchange_failed');
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
      return res.redirect('/connections?error=mailchimp_user_info_failed');
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
    res.redirect('/connections?success=mailchimp_connected');

  } catch (error) {
    console.error('Mailchimp OAuth callback error:', error);
    res.redirect('/connections?error=mailchimp_oauth_error');
  }
} 
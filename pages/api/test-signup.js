export default async function handler(req, res) {
  console.log('=== TEST SIGNUP START ===');
  console.log('Test endpoint called:', {
    method: req.method,
    url: req.url,
    headers: req.headers,
    body: req.body
  });

  try {
    // Test basic functionality
    console.log('Testing basic functionality...');
    
    // Test environment variables
    console.log('Environment check:', {
      NODE_ENV: process.env.NODE_ENV,
      hasDatabaseUrl: !!process.env.DATABASE_URL,
      hasNextAuthSecret: !!process.env.NEXTAUTH_SECRET
    });

    // Test Prisma import (without using it)
    try {
      const { PrismaClient } = await import('@prisma/client');
      console.log('Prisma import successful');
    } catch (error) {
      console.error('Prisma import failed:', error);
    }

    // Test bcrypt import
    try {
      const bcrypt = await import('bcryptjs');
      console.log('Bcrypt import successful');
    } catch (error) {
      console.error('Bcrypt import failed:', error);
    }

    console.log('=== TEST SIGNUP SUCCESS ===');
    res.status(200).json({ 
      message: 'Test endpoint working',
      timestamp: new Date().toISOString(),
      environment: process.env.NODE_ENV
    });

  } catch (error) {
    console.error('=== TEST SIGNUP ERROR ===');
    console.error('Test error:', error);
    res.status(500).json({ error: 'Test endpoint failed' });
  }
} 
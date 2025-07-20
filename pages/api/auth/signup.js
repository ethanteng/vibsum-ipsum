import bcrypt from 'bcryptjs';
import { prisma } from '../../../lib/prisma';

export default async function handler(req, res) {
  // Simple test to see if route is hit
  console.log('SIGNUP ROUTE HIT');
  
  try {
    console.log('=== SIGNUP API START ===');
    console.log('Signup API called:', {
      method: req.method,
      url: req.url,
      headers: req.headers,
      body: req.body
    });

    if (req.method !== 'POST') {
      console.log('Method not allowed:', req.method);
      return res.status(405).json({ error: 'Method not allowed' });
    }

    console.log('Signup request received:', { 
      hasBody: !!req.body, 
      contentType: req.headers['content-type'],
      bodyKeys: req.body ? Object.keys(req.body) : []
    });

    const { email, password, name } = req.body;

    if (!email || !password) {
      console.log('Missing required fields:', { email: !!email, password: !!password });
      return res.status(400).json({ error: 'Email and password are required' });
    }

    console.log('About to check for existing user...');
    
    // Check if user already exists with retry logic
    let existingUser;
    let findRetries = 3;
    
    while (findRetries > 0) {
      try {
        existingUser = await prisma.user.findUnique({
          where: { email },
        });
        break; // Success, exit retry loop
      } catch (error) {
        findRetries--;
        console.log(`Database query failed, retries left: ${findRetries}`, error.message);
        
        if (findRetries === 0) {
          throw error; // Re-throw if all retries exhausted
        }
        
        // Wait a bit before retrying
        await new Promise(resolve => setTimeout(resolve, 100));
      }
    }

    console.log('Existing user check complete:', { found: !!existingUser });

    if (existingUser) {
      console.log('User already exists:', email);
      return res.status(400).json({ error: 'User already exists' });
    }

    console.log('About to hash password...');
    
    // Hash password
    const hashedPassword = await bcrypt.hash(password, 12);
    console.log('Password hashed successfully');

    console.log('About to create user...');
    
    // Create user with retry logic
    let user;
    let createRetries = 3;
    
    while (createRetries > 0) {
      try {
        user = await prisma.user.create({
          data: {
            email,
            password: hashedPassword,
            name: name || null,
          },
        });
        break; // Success, exit retry loop
      } catch (error) {
        createRetries--;
        console.log(`User creation failed, retries left: ${createRetries}`, error.message);
        
        if (createRetries === 0) {
          throw error; // Re-throw if all retries exhausted
        }
        
        // Wait a bit before retrying
        await new Promise(resolve => setTimeout(resolve, 100));
      }
    }

    console.log('User created successfully:', { id: user.id, email: user.email });

    const response = { 
      message: 'User created successfully',
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
      }
    };

    console.log('About to send response:', response);
    res.status(201).json(response);
    console.log('=== SIGNUP API SUCCESS ===');

  } catch (error) {
    console.error('=== SIGNUP API ERROR ===');
    console.error('Signup error details:', {
      message: error.message,
      stack: error.stack,
      code: error.code,
      name: error.name
    });
    
    // Check if it's a database connection issue
    if (error.code === 'P1001') {
      console.error('Database connection failed');
      return res.status(500).json({ error: 'Database connection failed' });
    }
    
    // Check if it's a Prisma validation error
    if (error.code === 'P2002') {
      console.error('User already exists (Prisma)');
      return res.status(400).json({ error: 'User already exists' });
    }

    // Check if it's a Prisma client initialization error
    if (error.message && error.message.includes('PrismaClientInitializationError')) {
      console.error('Prisma client initialization failed');
      return res.status(500).json({ error: 'Database initialization failed' });
    }
    
    console.error('Generic internal server error');
    res.status(500).json({ error: 'Internal server error' });
  }
} 
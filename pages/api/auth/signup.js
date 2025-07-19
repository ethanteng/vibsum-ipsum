import bcrypt from 'bcryptjs';
import { prisma } from '../../../lib/prisma';

export default async function handler(req, res) {
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

  try {
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

    // Check if user already exists
    const existingUser = await prisma.user.findUnique({
      where: { email },
    });

    if (existingUser) {
      console.log('User already exists:', email);
      return res.status(400).json({ error: 'User already exists' });
    }

    // Hash password
    const hashedPassword = await bcrypt.hash(password, 12);

    // Create user
    const user = await prisma.user.create({
      data: {
        email,
        password: hashedPassword,
        name: name || null,
      },
    });

    console.log('User created successfully:', { id: user.id, email: user.email });

    res.status(201).json({ 
      message: 'User created successfully',
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
      }
    });
  } catch (error) {
    console.error('Signup error:', error);
    
    // Check if it's a database connection issue
    if (error.code === 'P1001') {
      return res.status(500).json({ error: 'Database connection failed' });
    }
    
    // Check if it's a Prisma validation error
    if (error.code === 'P2002') {
      return res.status(400).json({ error: 'User already exists' });
    }
    
    res.status(500).json({ error: 'Internal server error' });
  }
} 
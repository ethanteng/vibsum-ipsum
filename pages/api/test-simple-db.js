import { prisma } from '../../lib/prisma';

export default async function handler(req, res) {
  console.log('=== SIMPLE DATABASE TEST ===');
  
  try {
    console.log('1. Testing Prisma client...');
    
    // Test 1: Simple query
    console.log('2. Running simple query...');
    const result = await prisma.$queryRaw`SELECT 1 as test`;
    console.log('3. Query result:', result);
    
    // Test 2: Check if User table exists
    console.log('4. Checking User table...');
    const tables = await prisma.$queryRaw`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public' AND table_name = 'User'
    `;
    console.log('5. User table check:', tables);
    
    // Test 3: Try to count users
    console.log('6. Counting users...');
    const userCount = await prisma.user.count();
    console.log('7. User count:', userCount);
    
    res.status(200).json({
      success: true,
      message: 'Database operations successful',
      userCount: userCount,
      tables: tables
    });
    
  } catch (error) {
    console.error('=== SIMPLE DATABASE TEST ERROR ===');
    console.error('Error details:', {
      message: error.message,
      name: error.name,
      code: error.code,
      stack: error.stack
    });
    
    res.status(500).json({
      success: false,
      error: error.message,
      name: error.name,
      code: error.code
    });
  }
} 
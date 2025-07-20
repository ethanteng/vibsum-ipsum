export default async function handler(req, res) {
  console.log('=== DATABASE CONNECTION TEST ===');
  
  try {
    // Test 1: Check if DATABASE_URL exists
    console.log('1. DATABASE_URL exists:', !!process.env.DATABASE_URL);
    console.log('2. DATABASE_URL starts with:', process.env.DATABASE_URL?.substring(0, 20) + '...');
    
    // Test 2: Try to import Prisma
    console.log('3. Importing Prisma...');
    const { PrismaClient } = require('@prisma/client');
    console.log('4. Prisma imported successfully');
    
    // Test 3: Try to create Prisma client
    console.log('5. Creating Prisma client...');
    const prisma = new PrismaClient();
    console.log('6. Prisma client created');
    
    // Test 4: Try to connect to database
    console.log('7. Testing database connection...');
    await prisma.$connect();
    console.log('8. Database connection successful!');
    
    // Test 5: Try a simple query
    console.log('9. Testing simple query...');
    const result = await prisma.$queryRaw`SELECT 1 as test`;
    console.log('10. Query result:', result);
    
    // Test 6: Check if tables exist
    console.log('11. Checking tables...');
    const tables = await prisma.$queryRaw`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public'
    `;
    console.log('12. Available tables:', tables);
    
    await prisma.$disconnect();
    
    res.status(200).json({
      success: true,
      message: 'Database connection successful',
      tables: tables
    });
    
  } catch (error) {
    console.error('=== DATABASE CONNECTION ERROR ===');
    console.error('Error details:', {
      message: error.message,
      name: error.name,
      code: error.code
    });
    
    res.status(500).json({
      success: false,
      error: error.message,
      name: error.name,
      code: error.code
    });
  }
} 
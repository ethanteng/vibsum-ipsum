export default async function handler(req, res) {
  console.log('=== SUPABASE CONNECTION TEST ===');
  
  try {
    // Test 1: Check environment
    console.log('1. Environment:', process.env.NODE_ENV);
    console.log('2. DATABASE_URL exists:', !!process.env.DATABASE_URL);
    console.log('3. DATABASE_URL format check:', process.env.DATABASE_URL?.includes('supabase.co'));
    
    // Test 2: Try to connect with explicit SSL
    console.log('4. Testing connection...');
    
    // Import pg directly to test connection
    const { Client } = require('pg');
    
    const connectionString = process.env.DATABASE_URL;
    console.log('5. Connection string starts with:', connectionString?.substring(0, 30) + '...');
    
    const client = new Client({
      connectionString: connectionString,
      ssl: {
        rejectUnauthorized: false
      }
    });
    
    console.log('6. Attempting to connect...');
    await client.connect();
    console.log('7. Connection successful!');
    
    // Test query
    const result = await client.query('SELECT NOW() as current_time');
    console.log('8. Query result:', result.rows[0]);
    
    await client.end();
    
    res.status(200).json({
      success: true,
      message: 'Supabase connection successful',
      currentTime: result.rows[0].current_time
    });
    
  } catch (error) {
    console.error('=== SUPABASE CONNECTION ERROR ===');
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
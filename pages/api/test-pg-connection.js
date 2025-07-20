import { Client } from 'pg';

export default async function handler(req, res) {
  console.log('=== TESTING PG CONNECTION ===');
  
  try {
    console.log('1. Testing direct pg connection...');
    
    const client = new Client({
      connectionString: process.env.DATABASE_URL,
      ssl: {
        rejectUnauthorized: false
      }
    });
    
    console.log('2. Attempting to connect...');
    await client.connect();
    console.log('3. Connection successful!');
    
    // Test query
    console.log('4. Running test query...');
    const result = await client.query('SELECT NOW() as current_time');
    console.log('5. Query result:', result.rows[0]);
    
    // Check tables
    console.log('6. Checking tables...');
    const tables = await client.query(`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public'
    `);
    console.log('7. Available tables:', tables.rows);
    
    await client.end();
    
    res.status(200).json({
      success: true,
      message: 'Direct pg connection successful',
      currentTime: result.rows[0].current_time,
      tables: tables.rows.map(t => t.table_name)
    });
    
  } catch (error) {
    console.error('=== PG CONNECTION ERROR ===');
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
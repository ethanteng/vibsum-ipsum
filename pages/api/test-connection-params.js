export default async function handler(req, res) {
  console.log('=== TESTING CONNECTION PARAMETERS ===');
  
  const dbUrl = process.env.DATABASE_URL;
  
  // Test different connection string formats
  const testUrls = [
    // Current URL
    dbUrl,
    // With connection pooling
    dbUrl + '?connection_limit=1&pool_timeout=20',
    // With pgbouncer mode
    dbUrl + '?pgbouncer=true&connection_limit=1',
    // With SSL and pooling
    dbUrl + '?sslmode=require&connection_limit=1&pool_timeout=20'
  ];
  
  console.log('Testing different connection string formats...');
  
  res.status(200).json({
    currentUrl: dbUrl?.substring(0, 50) + '...',
    testUrls: testUrls.map((url, i) => ({
      index: i,
      url: url?.substring(0, 50) + '...',
      hasParams: url?.includes('?'),
      paramCount: (url?.match(/\?/g) || []).length
    }))
  });
} 
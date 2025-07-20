export default async function handler(req, res) {
  console.log('=== DEBUG CONNECTION STRING ===');
  
  const dbUrl = process.env.DATABASE_URL;
  
  if (!dbUrl) {
    return res.status(200).json({
      error: 'DATABASE_URL is not set'
    });
  }
  
  // Show the connection string with password masked
  const maskedUrl = dbUrl.replace(/:([^@]+)@/, ':****@');
  
  console.log('Current DATABASE_URL:', maskedUrl);
  
  res.status(200).json({
    hasDatabaseUrl: true,
    maskedUrl: maskedUrl,
    length: dbUrl.length,
    containsPooler: dbUrl.includes('pooler'),
    containsPort6543: dbUrl.includes(':6543'),
    containsPostgres: dbUrl.includes('/postgres'),
    // Check for problematic characters
    hasAmpersand: dbUrl.includes('&'),
    hasEquals: dbUrl.includes('='),
    hasQuestionMark: dbUrl.includes('?'),
    hasPercent: dbUrl.includes('%')
  });
} 
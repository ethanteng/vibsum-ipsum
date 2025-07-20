export default async function handler(req, res) {
  console.log('=== CHECKING DATABASE CONNECTION STRING ===');
  
  const dbUrl = process.env.DATABASE_URL;
  
  console.log('1. DATABASE_URL exists:', !!dbUrl);
  console.log('2. DATABASE_URL length:', dbUrl?.length);
  console.log('3. DATABASE_URL starts with:', dbUrl?.substring(0, 30) + '...');
  console.log('4. DATABASE_URL contains supabase.co:', dbUrl?.includes('supabase.co'));
  console.log('5. DATABASE_URL contains pooler:', dbUrl?.includes('pooler'));
  console.log('6. DATABASE_URL port:', dbUrl?.match(/:\d+\//)?.[0]);
  
  // Check if it looks like the correct format
  const isCorrectFormat = dbUrl?.includes('pooler.supabase.com') && dbUrl?.includes(':6543/');
  
  res.status(200).json({
    hasDatabaseUrl: !!dbUrl,
    urlLength: dbUrl?.length,
    startsWith: dbUrl?.substring(0, 30) + '...',
    containsSupabase: dbUrl?.includes('supabase.co'),
    containsPooler: dbUrl?.includes('pooler'),
    port: dbUrl?.match(/:\d+\//)?.[0],
    isCorrectFormat: isCorrectFormat,
    message: isCorrectFormat 
      ? 'Connection string format looks correct' 
      : 'Connection string format may be incorrect - should contain pooler.supabase.com:6543'
  });
} 
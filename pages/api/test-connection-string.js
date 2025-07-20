export default async function handler(req, res) {
  console.log('=== TESTING CONNECTION STRING ===');
  
  try {
    const dbUrl = process.env.DATABASE_URL;
    
    console.log('1. DATABASE_URL exists:', !!dbUrl);
    console.log('2. DATABASE_URL length:', dbUrl?.length);
    console.log('3. DATABASE_URL starts with:', dbUrl?.substring(0, 50) + '...');
    
    // Check for common issues
    const issues = [];
    
    if (!dbUrl) {
      issues.push('DATABASE_URL is not set');
    } else {
      if (!dbUrl.includes('pooler.supabase.com')) {
        issues.push('Should use pooler.supabase.com, not direct connection');
      }
      
      if (!dbUrl.includes(':6543/')) {
        issues.push('Should use port 6543, not 5432');
      }
      
      if (!dbUrl.includes('sslmode=require')) {
        issues.push('Missing sslmode=require parameter');
      }
      
      // Check for unencoded characters
      if (dbUrl.includes('&') && !dbUrl.includes('%26')) {
        issues.push('& characters should be URL encoded as %26');
      }
      
      if (dbUrl.includes('=') && !dbUrl.includes('%3D')) {
        issues.push('= characters in parameters should be URL encoded as %3D');
      }
    }
    
    console.log('4. Issues found:', issues);
    
    res.status(200).json({
      hasDatabaseUrl: !!dbUrl,
      urlLength: dbUrl?.length,
      startsWith: dbUrl?.substring(0, 50) + '...',
      issues: issues,
      isValid: issues.length === 0
    });
    
  } catch (error) {
    console.error('=== CONNECTION STRING TEST ERROR ===');
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
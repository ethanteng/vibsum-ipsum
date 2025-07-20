import { prisma } from './prisma';

export async function getUserMailchimpToken(userId) {
  let retries = 3;
  
  while (retries > 0) {
    try {
      const token = await prisma.mailchimpToken.findUnique({
        where: { userId }
      });
      
      if (!token) {
        return null;
      }
      
      // Check if token is expired
      if (token.expiresAt && new Date() > token.expiresAt) {
        // TODO: Implement token refresh logic
        return null;
      }
      
      return token.accessToken;
    } catch (error) {
      retries--;
      console.log(`Mailchimp token query failed, retries left: ${retries}`, error.message);
      
      if (retries === 0) {
        throw error;
      }
      
      // If it's a prepared statement error, reset the connection
      if (error.message && error.message.includes('prepared statement')) {
        console.log('Mailchimp token prepared statement error, resetting connection...');
        await prisma.$reset();
      }
      
      // Wait a bit before retrying
      await new Promise(resolve => setTimeout(resolve, 200));
    }
  }
}

export async function getUserIntercomToken(userId) {
  let retries = 3;
  
  while (retries > 0) {
    try {
      const token = await prisma.intercomToken.findUnique({
        where: { userId }
      });
      
      if (!token) {
        return null;
      }
      
      // Check if token is expired
      if (token.expiresAt && new Date() > token.expiresAt) {
        // TODO: Implement token refresh logic
        return null;
      }
      
      return token.accessToken;
    } catch (error) {
      retries--;
      console.log(`Intercom token query failed, retries left: ${retries}`, error.message);
      
      if (retries === 0) {
        throw error;
      }
      
      // If it's a prepared statement error, reset the connection
      if (error.message && error.message.includes('prepared statement')) {
        console.log('Intercom token prepared statement error, resetting connection...');
        await prisma.$reset();
      }
      
      // Wait a bit before retrying
      await new Promise(resolve => setTimeout(resolve, 200));
    }
  }
} 
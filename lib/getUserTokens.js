import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

export async function getUserMailchimpToken(userId) {
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
}

export async function getUserIntercomToken(userId) {
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
} 
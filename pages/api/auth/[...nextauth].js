import NextAuth from 'next-auth';
import CredentialsProvider from 'next-auth/providers/credentials';
import bcrypt from 'bcryptjs';
import { prisma } from '../../../lib/prisma';

export const authOptions = {
  providers: [
    CredentialsProvider({
      name: 'Credentials',
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" }
      },
      async authorize(credentials) {
        if (!credentials?.email || !credentials?.password) {
          return null;
        }

        // Add retry logic for serverless connection issues
        let user;
        let retries = 3;
        
        while (retries > 0) {
          try {
            user = await prisma.user.findUnique({
              where: { email: credentials.email }
            });
            break; // Success, exit retry loop
          } catch (error) {
            retries--;
            console.log(`Database query failed, retries left: ${retries}`, error.message);
            
            if (retries === 0) {
              throw error; // Re-throw if all retries exhausted
            }
            
            // Wait a bit before retrying
            await new Promise(resolve => setTimeout(resolve, 100));
          }
        }

        if (!user) {
          return null;
        }

        const isPasswordValid = await bcrypt.compare(credentials.password, user.password);

        if (!isPasswordValid) {
          return null;
        }

        return {
          id: user.id,
          email: user.email,
          name: user.name,
        };
      }
    }),
  ],
  session: {
    strategy: 'jwt',
    maxAge: 30 * 24 * 60 * 60, // 30 days
  },
  cookies: {
    sessionToken: {
      name: `next-auth.session-token`,
      options: {
        httpOnly: true,
        sameSite: 'lax',
        path: '/',
        secure: process.env.NODE_ENV === 'production',
      },
    },
  },
  callbacks: {
    async jwt({ token, user, account }) {
      if (user) {
        token.id = user.id;
      }
      
      return token;
    },
    async session({ session, token }) {
      if (token) {
        session.user.id = token.id;
        
        // Add OAuth connection status to session with retry logic
        let mailchimpToken, intercomToken;
        let retries = 3;
        
        while (retries > 0) {
          try {
            mailchimpToken = await prisma.mailchimpToken.findUnique({
              where: { userId: token.id }
            });
            
            intercomToken = await prisma.intercomToken.findUnique({
              where: { userId: token.id }
            });
            break; // Success, exit retry loop
          } catch (error) {
            retries--;
            console.log(`Session query failed, retries left: ${retries}`, error.message);
            
            if (retries === 0) {
              // Don't throw, just set to null to avoid breaking session
              mailchimpToken = null;
              intercomToken = null;
              break;
            }
            
            // Wait a bit before retrying
            await new Promise(resolve => setTimeout(resolve, 100));
          }
        }
        
        session.connections = {
          mailchimp: !!mailchimpToken,
          intercom: !!intercomToken,
        };
      }
      return session;
    },
  },
  pages: {
    signIn: '/auth/signin',
    signUp: '/auth/signup',
  },
};

export default NextAuth(authOptions); 
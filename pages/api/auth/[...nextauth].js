import NextAuth from 'next-auth';
import CredentialsProvider from 'next-auth/providers/credentials';
import bcrypt from 'bcryptjs';
import { prisma } from '../../../lib/prisma';
import { findUserByEmail } from '../../../lib/db';

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

        // Use direct database query to avoid Prisma prepared statement issues
        const user = await findUserByEmail(credentials.email);

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
            
            // If it's a prepared statement error, reset the connection
            if (error.message && error.message.includes('prepared statement')) {
              console.log('Session query prepared statement error, resetting connection...');
              await prisma.$reset();
            }
            
            // Wait a bit before retrying
            await new Promise(resolve => setTimeout(resolve, 200));
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
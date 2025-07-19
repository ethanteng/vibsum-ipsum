import NextAuth from 'next-auth';
import CredentialsProvider from 'next-auth/providers/credentials';
import bcrypt from 'bcryptjs';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

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

        const user = await prisma.user.findUnique({
          where: { email: credentials.email }
        });

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
    {
      id: "intercom",
      name: "Intercom",
      type: "oauth",
      authorization: {
        url: "https://app.intercom.com/oauth",
        params: {
          scope: "read write",
          response_type: "code",
        },
      },
      token: "https://api.intercom.io/auth/eagle/token",
      userinfo: "https://api.intercom.io/me",
      profile(profile) {
        return {
          id: profile.id,
          name: profile.name,
          email: profile.email,
        };
      },
      clientId: process.env.INTERCOM_CLIENT_ID,
      clientSecret: process.env.INTERCOM_CLIENT_SECRET,
    },
  ],
  session: {
    strategy: 'jwt',
  },
  callbacks: {
    async jwt({ token, user, account }) {
      if (user) {
        token.id = user.id;
      }
      
      // Store OAuth tokens when user connects accounts
      if (account) {
        if (account.provider === 'intercom') {
          await prisma.intercomToken.upsert({
            where: { userId: token.id },
            update: {
              accessToken: account.access_token,
              refreshToken: account.refresh_token,
              expiresAt: account.expires_at ? new Date(account.expires_at * 1000) : null,
            },
            create: {
              userId: token.id,
              accessToken: account.access_token,
              refreshToken: account.refresh_token,
              expiresAt: account.expires_at ? new Date(account.expires_at * 1000) : null,
            },
          });
        }
      }
      
      return token;
    },
    async session({ session, token }) {
      if (token) {
        session.user.id = token.id;
        
        // Add OAuth connection status to session
        const mailchimpToken = await prisma.mailchimpToken.findUnique({
          where: { userId: token.id }
        });
        
        const intercomToken = await prisma.intercomToken.findUnique({
          where: { userId: token.id }
        });
        
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
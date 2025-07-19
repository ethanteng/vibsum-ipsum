import NextAuth from 'next-auth';
import CredentialsProvider from 'next-auth/providers/credentials';
import bcrypt from 'bcryptjs';
import { PrismaClient } from '@prisma/client';

// Custom OAuth providers (we'll implement these)
const MailchimpProvider = {
  id: "mailchimp",
  name: "Mailchimp",
  type: "oauth",
  authorization: {
    url: "https://login.mailchimp.com/oauth2/authorize",
    params: {
      scope: "campaigns:read campaigns:write",
      response_type: "code",
    },
  },
  token: "https://login.mailchimp.com/oauth2/token",
  userinfo: "https://login.mailchimp.com/oauth2/metadata",
  profile(profile) {
    return {
      id: profile.user_id,
      name: profile.accountname,
      email: profile.login.email,
    };
  },
  clientId: process.env.MAILCHIMP_CLIENT_ID,
  clientSecret: process.env.MAILCHIMP_CLIENT_SECRET,
};

const IntercomProvider = {
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
};

const prisma = new PrismaClient();

export default NextAuth({
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
    MailchimpProvider,
    IntercomProvider,
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
        if (account.provider === 'mailchimp') {
          await prisma.mailchimpToken.upsert({
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
}); 
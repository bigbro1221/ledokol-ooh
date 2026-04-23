import NextAuth from 'next-auth';
import Credentials from 'next-auth/providers/credentials';
import Google from 'next-auth/providers/google';
import { PrismaAdapter } from '@auth/prisma-adapter';
import { compare } from 'bcryptjs';
import { prisma } from '@/lib/db';
import type { UserRole } from '@prisma/client';

declare module 'next-auth' {
  interface User {
    role: UserRole;
    clientId: string | null;
  }
  interface Session {
    user: {
      id: string;
      email: string;
      role: UserRole;
      clientId: string | null;
    };
  }
}

declare module '@auth/core/jwt' {
  interface JWT {
    role: UserRole;
    clientId: string | null;
  }
}

export function isGoogleOAuthConfigured(): boolean {
  return !!(process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET);
}

export async function isGoogleLinked(userId: string): Promise<boolean> {
  const count = await prisma.account.count({
    where: { userId, provider: 'google' },
  });
  return count > 0;
}

const googleProvider = isGoogleOAuthConfigured()
  ? Google({
      clientId: process.env.GOOGLE_CLIENT_ID!,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
      // Allow linking Google to an existing credentials-based account.
      allowDangerousEmailAccountLinking: true,
    })
  : null;

export const { handlers, auth, signIn, signOut } = NextAuth({
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  adapter: PrismaAdapter(prisma) as any,
  providers: [
    Credentials({
      name: 'credentials',
      credentials: {
        email: { label: 'Email', type: 'email' },
        code: { label: 'Code', type: 'text' },
      },
      async authorize(credentials) {
        if (!credentials?.email || !credentials?.code) return null;

        const email = (credentials.email as string).trim().toLowerCase();
        const code = credentials.code as string;

        const user = await prisma.user.findFirst({
          where: { email: { equals: email, mode: 'insensitive' } },
        });
        if (!user || !user.enabled) return null;

        const loginCode = await prisma.emailLoginCode.findFirst({
          where: {
            userId: user.id,
            consumedAt: null,
            expiresAt: { gt: new Date() },
          },
          orderBy: { createdAt: 'desc' },
        });
        if (!loginCode) return null;

        const updated = await prisma.emailLoginCode.update({
          where: { id: loginCode.id },
          data: { attemptCount: { increment: 1 } },
        });

        if (updated.attemptCount > 5) {
          await prisma.emailLoginCode.update({
            where: { id: loginCode.id },
            data: { consumedAt: new Date() },
          });
          return null;
        }

        const isValid = await compare(code, loginCode.codeHash);
        if (!isValid) return null;

        await prisma.emailLoginCode.update({
          where: { id: loginCode.id },
          data: { consumedAt: new Date() },
        });

        return { id: user.id, email: user.email, role: user.role, clientId: user.clientId };
      },
    }),
    ...(googleProvider ? [googleProvider] : []),
  ],
  session: { strategy: 'jwt', maxAge: 24 * 60 * 60 },
  pages: { signIn: '/login' },
  callbacks: {
    async signIn({ user, account, profile }) {
      if (account?.provider === 'credentials') return true; // authorize() already checks enabled

      if (account?.provider === 'google') {
        const email = user?.email ?? profile?.email;
        if (!email) return false;

        const existing = await prisma.user.findUnique({
          where: { email },
          select: { id: true, enabled: true },
        });

        if (!existing) return false;
        if (!existing.enabled) return false;
        return true;
      }

      return true;
    },
    async jwt({ token, user }) {
      if (user) {
        // For Credentials sign-in, user has role/clientId directly (typed via module augmentation).
        // For OAuth (Google), the adapter returns the full Prisma User at runtime, but
        // TypeScript's AdapterUser type omits our custom fields — fetch from DB to be safe.
        const u = user as typeof user & { role?: UserRole; clientId?: string | null };
        if (u.role) {
          token.role = u.role;
          token.clientId = u.clientId ?? null;
        } else {
          const dbUser = await prisma.user.findUnique({
            where: { id: token.sub! },
            select: { role: true, clientId: true },
          });
          token.role = dbUser?.role ?? 'CLIENT';
          token.clientId = dbUser?.clientId ?? null;
        }
      }
      return token;
    },
    async session({ session, token }) {
      session.user.id = token.sub!;
      session.user.role = token.role;
      session.user.clientId = token.clientId;
      return session;
    },
  },
});

import NextAuth, { type Session } from 'next-auth';
import Credentials from 'next-auth/providers/credentials';
import Google from 'next-auth/providers/google';
import { PrismaAdapter } from '@auth/prisma-adapter';
import { compare } from 'bcryptjs';
import { prisma } from '@/lib/db';
import type { UserRole } from '@prisma/client';
import { authConfig } from './auth.config';
import { consumeActivationToken } from '@/lib/activation';

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
      // Force Google to show the account chooser every time instead of
      // silently picking whichever account the browser is signed into.
      authorization: { params: { prompt: 'select_account' } },
    })
  : null;

// Late-bound reference to NextAuth's auth() helper. Initialized at the bottom
// of this module after NextAuth() returns it. Adapter methods only run during
// request handling (long after module init), so this is safe.
const lateBound: { auth?: () => Promise<Session | null> } = {};

const basePrismaAdapter = PrismaAdapter(prisma) as any;
const authAdapter = {
  ...basePrismaAdapter,
  getUserByAccount: async (input: { provider: string; providerAccountId: string }) => {
    const result = await basePrismaAdapter.getUserByAccount(input);
    console.log('[auth] getUserByAccount', { provider: input.provider, sub: input.providerAccountId, found: !!result, email: result?.email });
    return result;
  },
  // Disable email-based auto-linking — User.email no longer has to match the
  // Google account's email.
  getUserByEmail: async (email: string) => {
    console.log('[auth] getUserByEmail (returning null by override)', { email });
    return null;
  },
  // The adapter only reaches createUser when (a) no Account row exists for this
  // (provider, providerAccountId) and (b) getUserByEmail returned null.
  createUser: async (data: unknown) => {
    const incomingEmail = (data as { email?: string }).email;
    console.log('[auth] createUser entry', { incomingEmail, lateBoundDefined: !!lateBound.auth });
    let session: Session | null = null;
    try {
      session = lateBound.auth ? await lateBound.auth() : null;
    } catch (e) {
      console.error('[auth] createUser auth() threw', { error: e instanceof Error ? e.message : String(e) });
    }
    console.log('[auth] createUser session', { hasSession: !!session, sessionUserId: session?.user?.id, sessionUserEmail: session?.user?.email });
    if (!session?.user?.id) {
      console.error('[auth] createUser blocked: no active session', { incomingEmail });
      throw new Error('OAuthSignupNotAllowed');
    }
    const current = await prisma.user.findUnique({ where: { id: session.user.id } });
    if (!current || !current.enabled) {
      console.error('[auth] createUser blocked: session user missing or disabled', { sessionUserId: session.user.id });
      throw new Error('OAuthSignupNotAllowed');
    }
    console.log('[auth] createUser linking google to session user', { sessionUserEmail: current.email });
    return current;
  },
  linkAccount: async (input: unknown) => {
    const i = input as { userId: string; provider: string; providerAccountId: string };
    console.log('[auth] linkAccount', { userId: i.userId, provider: i.provider, sub: i.providerAccountId });
    return basePrismaAdapter.linkAccount(input);
  },
};

export const { handlers, auth, signIn, signOut } = NextAuth({
  ...authConfig,
  adapter: authAdapter,
  providers: [
    Credentials({
      id: 'credentials',
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
    Credentials({
      id: 'activation-token',
      name: 'activation-token',
      credentials: {
        token: { label: 'Token', type: 'text' },
      },
      // One-shot login via an activation magic-link token. Consumes the token,
      // flips status to ACTIVE, and returns the user so NextAuth issues a
      // session. Google linking is enforced separately by the mustLinkGoogle
      // gate on protected pages.
      async authorize(credentials) {
        if (!credentials?.token) return null;
        const result = await consumeActivationToken(credentials.token as string);
        if (!result) return null;

        const user = await prisma.user.findUnique({ where: { id: result.userId } });
        if (!user || !user.enabled) return null;

        if (user.status === 'INVITED') {
          await prisma.user.update({
            where: { id: user.id },
            data: { status: 'ACTIVE' },
          });
        }

        return { id: user.id, email: user.email, role: user.role, clientId: user.clientId };
      },
    }),
    ...(googleProvider ? [googleProvider] : []),
  ],
  session: { strategy: 'jwt', maxAge: 24 * 60 * 60 },
  pages: { signIn: '/login' },
  callbacks: {
    ...authConfig.callbacks,
    async signIn({ user, account }) {
      console.log('[auth] signIn callback', { provider: account?.provider, userId: user?.id, userEmail: user?.email });
      if (account?.provider === 'credentials' || account?.provider === 'activation-token') {
        return true; // authorize() already gated everything
      }

      if (account?.provider === 'google') {
        if (!user?.id) {
          console.log('[auth] signIn google rejecting: no user.id from adapter');
          return '/login?error=GoogleNotInvited';
        }

        const appUser = await prisma.user.findUnique({
          where: { id: user.id },
          select: { id: true, enabled: true },
        });
        if (!appUser) {
          console.log('[auth] signIn google rejecting: user row missing', { userId: user.id });
          return '/login?error=GoogleNotInvited';
        }
        if (!appUser.enabled) {
          console.log('[auth] signIn google rejecting: account disabled', { userId: user.id });
          return '/login?error=AccountDisabled';
        }

        // If a session already exists, the Google account must resolve to the
        // same app user. Otherwise this is "Google linked to user A, but user
        // B is currently logged in trying to use it" — reject as in-use.
        const existing = lateBound.auth ? await lateBound.auth() : null;
        console.log('[auth] signIn google existing session check', { hasExisting: !!existing, existingUserId: existing?.user?.id, linkedUserId: appUser.id });
        if (existing?.user?.id && existing.user.id !== appUser.id) {
          console.log('[auth] signIn google rejecting: GoogleInUse');
          return '/login?error=GoogleInUse';
        }

        return true;
      }

      return true;
    },
    async jwt({ token, user }) {
      if (user) {
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
  },
});

// Wire up the late-bound reference so adapter methods + signIn callback can
// read the active session.
lateBound.auth = auth;

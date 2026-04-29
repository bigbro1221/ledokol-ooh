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
  // Disable email-based auto-linking — User.email no longer has to match the
  // Google account's email.
  getUserByEmail: async () => null,
  // The adapter only reaches createUser when (a) no Account row exists for this
  // (provider, providerAccountId) and (b) getUserByEmail returned null. That
  // happens whenever a user clicks "Link Google" on /profile while logged in.
  // We redirect the would-be insert to the current session's user so the
  // linkAccount call binds the Google identity to them — instead of creating
  // a phantom new user from the Google profile.
  createUser: async (data: unknown) => {
    const session = lateBound.auth ? await lateBound.auth() : null;
    if (!session?.user?.id) {
      console.error('[auth] createUser blocked: no active session', { incomingEmail: (data as { email?: string }).email });
      throw new Error('OAuthSignupNotAllowed');
    }
    const current = await prisma.user.findUnique({ where: { id: session.user.id } });
    if (!current || !current.enabled) {
      console.error('[auth] createUser blocked: session user missing or disabled', { sessionUserId: session.user.id });
      throw new Error('OAuthSignupNotAllowed');
    }
    console.log('[auth] createUser linking google account to session user', { sessionUserEmail: current.email });
    return current;
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
      if (account?.provider === 'credentials' || account?.provider === 'activation-token') {
        return true; // authorize() already gated everything
      }

      if (account?.provider === 'google') {
        if (!user?.id) return '/login?error=GoogleNotInvited';

        const appUser = await prisma.user.findUnique({
          where: { id: user.id },
          select: { id: true, enabled: true },
        });
        if (!appUser) return '/login?error=GoogleNotInvited';
        if (!appUser.enabled) return '/login?error=AccountDisabled';

        // If a session already exists, the Google account must resolve to the
        // same app user. Otherwise this is "Google linked to user A, but user
        // B is currently logged in trying to use it" — reject as in-use.
        const existing = lateBound.auth ? await lateBound.auth() : null;
        if (existing?.user?.id && existing.user.id !== appUser.id) {
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

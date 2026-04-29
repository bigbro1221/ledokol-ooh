import NextAuth, { type Session } from 'next-auth';
import Credentials from 'next-auth/providers/credentials';
import Google from 'next-auth/providers/google';
import { PrismaAdapter } from '@auth/prisma-adapter';
import { compare } from 'bcryptjs';
import { prisma } from '@/lib/db';
import type { UserRole } from '@prisma/client';
import { authConfig } from './auth.config';
import { consumeActivationToken } from '@/lib/activation';
import { recordAuthEvent } from '@/lib/audit';

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
    recordAuthEvent({
      type: 'getUserByAccount',
      provider: input.provider,
      userId: result?.id ?? null,
      userEmail: result?.email ?? null,
      message: result ? `Account found: ${result.email}` : 'Account not linked yet',
      metadata: { providerAccountId: input.providerAccountId, found: !!result },
    });
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
    const incomingEmail = (data as { email?: string }).email ?? null;
    console.log('[auth] createUser entry', { incomingEmail, lateBoundDefined: !!lateBound.auth });
    let session: Session | null = null;
    try {
      session = lateBound.auth ? await lateBound.auth() : null;
    } catch (e) {
      console.error('[auth] createUser auth() threw', { error: e instanceof Error ? e.message : String(e) });
    }
    if (!session?.user?.id) {
      console.error('[auth] createUser blocked: no active session', { incomingEmail });
      recordAuthEvent({
        type: 'createUser',
        level: 'ERROR',
        userEmail: incomingEmail,
        message: 'Blocked: no active session for OAuth link',
        metadata: { incomingEmail },
      });
      throw new Error('OAuthSignupNotAllowed');
    }
    const current = await prisma.user.findUnique({ where: { id: session.user.id } });
    if (!current || !current.enabled) {
      console.error('[auth] createUser blocked: session user missing or disabled', { sessionUserId: session.user.id });
      recordAuthEvent({
        type: 'createUser',
        level: 'ERROR',
        userId: session.user.id,
        message: 'Blocked: session user missing or disabled',
      });
      throw new Error('OAuthSignupNotAllowed');
    }
    console.log('[auth] createUser linking google to session user', { sessionUserEmail: current.email });
    recordAuthEvent({
      type: 'createUser',
      userId: current.id,
      userEmail: current.email,
      message: `Linking OAuth account to ${current.email}`,
      metadata: { incomingEmail },
    });
    return current;
  },
  linkAccount: async (input: unknown) => {
    const i = input as { userId: string; provider: string; providerAccountId: string };
    console.log('[auth] linkAccount', { userId: i.userId, provider: i.provider, sub: i.providerAccountId });
    recordAuthEvent({
      type: 'linkAccount',
      userId: i.userId,
      provider: i.provider,
      message: `Linked ${i.provider} account`,
      metadata: { providerAccountId: i.providerAccountId },
    });
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
        if (!user || !user.enabled) {
          recordAuthEvent({ type: 'otpLogin', level: 'ERROR', provider: 'credentials', userEmail: email, message: 'Rejected: user not found or disabled' });
          return null;
        }

        const loginCode = await prisma.emailLoginCode.findFirst({
          where: {
            userId: user.id,
            consumedAt: null,
            expiresAt: { gt: new Date() },
          },
          orderBy: { createdAt: 'desc' },
        });
        if (!loginCode) {
          recordAuthEvent({ type: 'otpLogin', level: 'ERROR', provider: 'credentials', userId: user.id, userEmail: user.email, message: 'Rejected: no valid code (expired or never sent)' });
          return null;
        }

        const updated = await prisma.emailLoginCode.update({
          where: { id: loginCode.id },
          data: { attemptCount: { increment: 1 } },
        });

        if (updated.attemptCount > 5) {
          await prisma.emailLoginCode.update({
            where: { id: loginCode.id },
            data: { consumedAt: new Date() },
          });
          recordAuthEvent({ type: 'otpLogin', level: 'WARN', provider: 'credentials', userId: user.id, userEmail: user.email, message: 'Rejected: too many code attempts; code consumed' });
          return null;
        }

        const isValid = await compare(code, loginCode.codeHash);
        if (!isValid) {
          recordAuthEvent({ type: 'otpLogin', level: 'WARN', provider: 'credentials', userId: user.id, userEmail: user.email, message: 'Rejected: wrong code', metadata: { attemptCount: updated.attemptCount } });
          return null;
        }

        await prisma.emailLoginCode.update({
          where: { id: loginCode.id },
          data: { consumedAt: new Date() },
        });

        recordAuthEvent({ type: 'otpLogin', provider: 'credentials', userId: user.id, userEmail: user.email, message: 'OTP login succeeded' });
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
        if (!result) {
          recordAuthEvent({ type: 'activate', level: 'ERROR', provider: 'activation-token', message: 'Rejected: activation token invalid/consumed/expired' });
          return null;
        }

        const user = await prisma.user.findUnique({ where: { id: result.userId } });
        if (!user || !user.enabled) {
          recordAuthEvent({ type: 'activate', level: 'ERROR', provider: 'activation-token', userId: result.userId, message: 'Rejected: user missing or disabled' });
          return null;
        }

        if (user.status === 'INVITED') {
          await prisma.user.update({
            where: { id: user.id },
            data: { status: 'ACTIVE' },
          });
        }

        recordAuthEvent({ type: 'activate', provider: 'activation-token', userId: user.id, userEmail: user.email, message: `Activated ${user.email}; status set to ACTIVE` });
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
        recordAuthEvent({
          type: 'signIn',
          provider: account.provider,
          userId: user?.id ?? null,
          userEmail: user?.email ?? null,
          message: `Signed in via ${account.provider}`,
        });
        return true;
      }

      if (account?.provider === 'google') {
        if (!user?.id) {
          console.log('[auth] signIn google rejecting: no user.id from adapter');
          recordAuthEvent({ type: 'signIn', level: 'ERROR', provider: 'google', message: 'Rejected: no user.id from adapter' });
          return '/login?error=GoogleNotInvited';
        }

        const appUser = await prisma.user.findUnique({
          where: { id: user.id },
          select: { id: true, enabled: true, email: true },
        });

        // Returning-user path
        if (appUser) {
          if (!appUser.enabled) {
            console.log('[auth] signIn google rejecting: account disabled', { userId: user.id });
            recordAuthEvent({ type: 'signIn', level: 'ERROR', provider: 'google', userId: appUser.id, userEmail: appUser.email, message: 'Rejected: account disabled' });
            return '/login?error=AccountDisabled';
          }
          const existing = lateBound.auth ? await lateBound.auth() : null;
          if (existing?.user?.id && existing.user.id !== appUser.id) {
            console.log('[auth] signIn google rejecting: GoogleInUse', { existingUserId: existing.user.id, linkedUserId: appUser.id });
            recordAuthEvent({
              type: 'signIn',
              level: 'ERROR',
              provider: 'google',
              userId: appUser.id,
              userEmail: appUser.email,
              message: 'Rejected: Google linked to different user than current session',
              metadata: { sessionUserId: existing.user.id },
            });
            return '/login?error=GoogleInUse';
          }
          recordAuthEvent({
            type: 'signIn',
            provider: 'google',
            userId: appUser.id,
            userEmail: appUser.email,
            message: `Signed in via Google (existing link)`,
          });
          return true;
        }

        // New-link path
        const existing = lateBound.auth ? await lateBound.auth() : null;
        console.log('[auth] signIn google new-link path', { hasExisting: !!existing, existingUserId: existing?.user?.id, syntheticUserId: user.id });
        if (!existing?.user?.id) {
          console.log('[auth] signIn google rejecting: no session for new link');
          recordAuthEvent({
            type: 'signIn',
            level: 'ERROR',
            provider: 'google',
            userEmail: user.email ?? null,
            message: 'Rejected: no session for new Google link (would-be self-signup)',
          });
          return '/login?error=GoogleNotInvited';
        }
        const sessionUser = await prisma.user.findUnique({
          where: { id: existing.user.id },
          select: { enabled: true, email: true },
        });
        if (!sessionUser || !sessionUser.enabled) {
          console.log('[auth] signIn google rejecting: session user disabled or missing');
          recordAuthEvent({ type: 'signIn', level: 'ERROR', provider: 'google', userId: existing.user.id, message: 'Rejected: session user disabled or missing' });
          return '/login?error=AccountDisabled';
        }
        recordAuthEvent({
          type: 'signIn',
          provider: 'google',
          userId: existing.user.id,
          userEmail: sessionUser.email,
          message: `Approving new Google link to ${sessionUser.email}`,
        });
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

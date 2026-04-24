import NextAuth from 'next-auth';
import Credentials from 'next-auth/providers/credentials';
import Google from 'next-auth/providers/google';
import { PrismaAdapter } from '@auth/prisma-adapter';
import { cookies } from 'next/headers';
import { compare } from 'bcryptjs';
import { prisma } from '@/lib/db';
import type { UserRole } from '@prisma/client';
import { authConfig } from './auth.config';

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

async function getInvitedUserIdFromCookie(): Promise<string | null> {
  const store = await cookies();
  return store.get('activation-session')?.value ?? null;
}

const basePrismaAdapter = PrismaAdapter(prisma) as any;
const authAdapter = {
  ...basePrismaAdapter,
  // Disable email-based auto-linking — User.email no longer has to match the
  // Google account's email. The activation-session cookie drives linking.
  getUserByEmail: async () => null,
  // The adapter only reaches createUser when (a) no Account row exists for this
  // (provider, providerAccountId) and (b) getUserByEmail returned null. We use
  // this as our gate: only allow "signup" during the activation flow, and
  // redirect the insert to the invited user row instead of creating a new one.
  createUser: async () => {
    const invitedId = await getInvitedUserIdFromCookie();
    if (!invitedId) throw new Error('OAuthSignupNotAllowed');
    const invited = await prisma.user.findUnique({ where: { id: invitedId } });
    if (!invited || !invited.enabled || invited.status !== 'INVITED') {
      throw new Error('OAuthSignupNotAllowed');
    }
    return invited;
  },
};

export const { handlers, auth, signIn, signOut } = NextAuth({
  ...authConfig,
  adapter: authAdapter,
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
    ...authConfig.callbacks,
    async signIn({ user, account }) {
      if (account?.provider === 'credentials') return true; // authorize() already checks enabled

      if (account?.provider === 'google') {
        if (!user?.id) return false;

        const appUser = await prisma.user.findUnique({
          where: { id: user.id },
          select: { id: true, enabled: true },
        });
        if (!appUser || !appUser.enabled) return false;

        // If an activation session is in progress, the signed-in user must be
        // the invited one. This closes a hole where a rogue Google account
        // could email-match (or be linked to) a different app user mid-flow.
        const invitedId = await getInvitedUserIdFromCookie();
        if (invitedId && invitedId !== appUser.id) return false;

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
  },
});

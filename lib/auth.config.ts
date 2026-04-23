import type { UserRole } from '@prisma/client';
import type { NextAuthConfig } from 'next-auth';

// Module augmentation lives here so it applies when middleware imports this file.
// Using `import type` means @prisma/client is erased at compile time — no runtime
// cost and no Node-only modules pulled into the edge bundle.
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

export const authConfig: NextAuthConfig = {
  session: { strategy: 'jwt' },
  pages: { signIn: '/login' },
  providers: [],
  callbacks: {
    session({ session, token }) {
      session.user.id = token.sub!;
      session.user.role = token.role;
      session.user.clientId = token.clientId;
      return session;
    },
  },
};

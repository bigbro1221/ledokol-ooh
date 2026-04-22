export async function register() {
  if (process.env.NEXT_RUNTIME !== 'nodejs') return;

  const email = process.env.ADMIN_USERNAME;
  const password = process.env.ADMIN_PASSWORD;

  if (!email || !password) {
    console.warn('[startup] ADMIN_USERNAME or ADMIN_PASSWORD not set — skipping admin bootstrap');
    return;
  }

  // webpackIgnore: webpack must not bundle these — they are Node.js-only and
  // resolved at runtime. Statically bundling them triggers edge-crypto warnings.
  const { PrismaClient } = await import(/* webpackIgnore: true */ '@prisma/client');
  const { hash } = await import(/* webpackIgnore: true */ 'bcryptjs');

  const prisma = new PrismaClient();
  try {
    const existing = await prisma.user.findUnique({ where: { email } });
    if (!existing) {
      await prisma.user.create({
        data: {
          email,
          passwordHash: await hash(password, 12),
          role: 'ADMIN',
          language: 'RU',
        },
      });
      console.log(`[startup] Admin user created: ${email}`);
    }
  } finally {
    await prisma.$disconnect();
  }
}

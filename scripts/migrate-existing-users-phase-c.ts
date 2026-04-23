/**
 * Phase C migration: mark all users with a non-null passwordHash as status=ACTIVE.
 * After prisma db push, all rows already default to ACTIVE; this script confirms
 * and logs the affected rows.
 *
 * Run: npx tsx scripts/migrate-existing-users-phase-c.ts
 */
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('[migrate-phase-c] Starting...');

  const usersWithHash = await prisma.user.findMany({
    where: { passwordHash: { not: null } },
    select: { id: true, email: true, status: true },
  });

  console.log(`[migrate-phase-c] Found ${usersWithHash.length} user(s) with passwordHash set`);

  let touched = 0;
  for (const user of usersWithHash) {
    if (user.status === 'INVITED' || user.status === 'DISABLED') {
      console.log(`  SKIP  ${user.email} — status is ${user.status}, leaving unchanged`);
      continue;
    }
    await prisma.user.update({
      where: { id: user.id },
      data: { status: 'ACTIVE' },
    });
    console.log(`  OK    ${user.email} — confirmed ACTIVE`);
    touched++;
  }

  console.log(`[migrate-phase-c] Done. ${touched} user(s) confirmed ACTIVE, ${usersWithHash.length - touched} skipped.`);
}

main()
  .catch((err) => {
    console.error('[migrate-phase-c] Error:', err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());

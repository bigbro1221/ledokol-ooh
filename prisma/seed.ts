import { PrismaClient } from '@prisma/client';
import { hash } from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
  const passwordHash = await hash('admin123', 12);

  const admin = await prisma.user.upsert({
    where: { email: 'admin@ledokol.uz' },
    update: {},
    create: {
      email: 'admin@ledokol.uz',
      passwordHash,
      role: 'ADMIN',
      language: 'RU',
    },
  });

  console.log(`Admin user ready: ${admin.email} / admin123`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());

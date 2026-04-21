import { prisma } from '@/lib/db';
import { Decimal } from '@prisma/client/runtime/library';

export async function getAppSettings() {
  return prisma.appSettings.upsert({
    where: { id: 1 },
    update: {},
    create: {},
  });
}

export async function updateAppSettings(patch: Partial<{ vatRate: Decimal; twoFactorRequired: boolean }>) {
  return prisma.appSettings.update({ where: { id: 1 }, data: patch });
}

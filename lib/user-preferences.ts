import { prisma } from '@/lib/db';
import { DateFormat as DBDateFormat } from '@prisma/client';

export { DBDateFormat };

export interface UserPreferencesData {
  dateFormat: DBDateFormat;
}

export async function getUserPreferences(userId: string): Promise<UserPreferencesData> {
  const prefs = await prisma.userPreferences.upsert({
    where: { userId },
    create: { userId, dateFormat: 'SMART_HYBRID' },
    update: {},
    select: { dateFormat: true },
  });
  return { dateFormat: prefs.dateFormat };
}

export async function updateUserPreferences(
  userId: string,
  patch: Partial<UserPreferencesData>,
): Promise<UserPreferencesData> {
  const prefs = await prisma.userPreferences.upsert({
    where: { userId },
    create: { userId, dateFormat: patch.dateFormat ?? 'SMART_HYBRID' },
    update: { dateFormat: patch.dateFormat },
    select: { dateFormat: true },
  });
  return { dateFormat: prefs.dateFormat };
}

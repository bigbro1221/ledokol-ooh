import { PrismaClient } from '@prisma/client';

const p = new PrismaClient();

async function run() {
  const clients = await p.client.count();
  const campaigns = await p.campaign.count();
  const screens = await p.screen.count();
  const pricing = await p.screenPricing.count();
  const users = await p.user.count();
  const byType = await p.screen.groupBy({ by: ['type'], _count: true });
  const byCity = await p.screen.groupBy({
    by: ['city'],
    _count: true,
    orderBy: { _count: { city: 'desc' } },
    take: 10,
  });
  const withPhotos = await p.screen.count({ where: { photoUrl: { not: null } } });

  console.log('=== DB VERIFICATION ===');
  console.log(`Clients: ${clients}`);
  console.log(`Campaigns: ${campaigns}`);
  console.log(`Screens: ${screens}`);
  console.log(`Pricing records: ${pricing}`);
  console.log(`Users: ${users}`);
  console.log(`With photo URLs: ${withPhotos}`);
  console.log('\nBy type:');
  byType.forEach((t) => console.log(`  ${t.type}: ${t._count}`));
  console.log('\nTop cities:');
  byCity.forEach((c) => console.log(`  ${c.city.trim()}: ${c._count}`));
  await p.$disconnect();
}

run();

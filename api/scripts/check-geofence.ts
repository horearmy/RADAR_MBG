import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();
async function main() {
  const nulls = await prisma.geofence.findMany({ where: { tenantId: null }, select: { id: true, sppgId: true, deliveryLocationId: true } });
  console.log(JSON.stringify(nulls, null, 2));
}
main().finally(() => prisma.$disconnect());

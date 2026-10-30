import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();
async function main() {
  const g = await prisma.geofence.count({ where: { tenantId: null } });
  console.log({ geofencesNullTenant: g });
}
main().finally(() => prisma.$disconnect());

import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();
async function main() {
  const t = await prisma.tenant.findFirst();
  console.log('tenant status:', t?.status);
}
main().finally(() => prisma.$disconnect());

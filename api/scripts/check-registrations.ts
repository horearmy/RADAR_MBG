import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();
async function main() {
  const regs = await prisma.tenantRegistration.findMany({ orderBy: { createdAt: 'desc' }, take: 5 });
  console.log(JSON.stringify(regs, null, 2));
}
main().finally(() => prisma.$disconnect());

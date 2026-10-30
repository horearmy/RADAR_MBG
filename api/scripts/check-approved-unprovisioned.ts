import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();
async function main() {
  const rows = await prisma.tenantRegistration.findMany({ where: { status: 'APPROVED', tenantId: null } });
  console.log(JSON.stringify(rows.map((r) => ({ id: r.id, number: r.registrationNumber })), null, 2));
}
main().finally(() => prisma.$disconnect());

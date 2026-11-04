import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();
async function main() {
  const u = await prisma.userRole.findMany({ where: { userId: '418f360b-5b3a-4e12-8432-5c3fe0960ace' }, include: { role: true } });
  console.log(JSON.stringify(u.map((x) => x.role.code), null, 2));
}
main().finally(() => prisma.$disconnect());

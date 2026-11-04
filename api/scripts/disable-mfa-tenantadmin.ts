import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();
async function main() {
  await prisma.user.update({ where: { username: 'tenantadmin' }, data: { mfaEnabled: false, mfaSecretEncrypted: null } });
  console.log('MFA disabled for tenantadmin');
}
main().finally(() => prisma.$disconnect());

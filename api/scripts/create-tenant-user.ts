import { PrismaClient } from '@prisma/client';
import * as argon2 from 'argon2';
const prisma = new PrismaClient();

async function main() {
  const tenant = await prisma.tenant.findFirst();
  if (!tenant) { console.log('no tenant'); return; }
  const username = 'tenantadmin';
  const password = 'TenantPass123!';
  const hash = await argon2.hash(password);
  const user = await prisma.user.upsert({
    where: { username },
    update: { passwordHash: hash, status: 'ACTIVE', passwordChangedAt: new Date() },
    create: { username, displayName: 'Tenant Admin', passwordHash: hash, status: 'ACTIVE', passwordChangedAt: new Date() },
  });
  await prisma.tenantMembership.upsert({
    where: { tenantId_userId: { tenantId: tenant.id, userId: user.id } },
    update: { role: 'TENANT_ADMIN', status: 'ACTIVE' },
    create: { tenantId: tenant.id, userId: user.id, role: 'TENANT_ADMIN', status: 'ACTIVE' },
  });
  console.log('username:', username);
  console.log('password:', password);
  console.log('tenant:', tenant.tenantCode);
}
main().finally(() => prisma.$disconnect());

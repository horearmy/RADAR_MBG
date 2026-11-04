import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();
async function main() {
  const admin = await prisma.user.findUnique({ where: { username: 'admin' } });
  if (!admin) { console.log('admin not found'); return; }
  const tenant = await prisma.tenant.findFirst();
  if (!tenant) { console.log('no tenant'); return; }
  await prisma.tenantMembership.upsert({
    where: { tenantId_userId: { tenantId: tenant.id, userId: admin.id } },
    update: { role: 'TENANT_ADMIN', status: 'ACTIVE' },
    create: { tenantId: tenant.id, userId: admin.id, role: 'TENANT_ADMIN', status: 'ACTIVE' },
  });
  console.log('linked admin to tenant', tenant.id);
}
main().finally(() => prisma.$disconnect());

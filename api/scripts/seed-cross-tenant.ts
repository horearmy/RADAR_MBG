// Seed two tenants for cross-tenant tests (dev only).
import { PrismaClient } from '@prisma/client';
import * as argon2 from 'argon2';
const prisma = new PrismaClient();

async function main() {
  const org = await prisma.organization.findFirst();
  const region = await prisma.region.findFirst({ where: org ? { organizationId: org.id } : undefined });

  async function makeTenant(code: string, name: string) {
    const sppg = await prisma.sppg.create({ data: { organizationId: org!.id, regionId: region!.id, code, name, status: 'ACTIVE' } });
    const tenant = await prisma.tenant.create({ data: { tenantCode: `T-${code}`, name, status: 'ACTIVE', legacySppgId: sppg.id } });
    await prisma.sppgProfile.create({ data: { tenantId: tenant.id, sppgName: name, fullAddress: 'Addr' } });
    const user = await prisma.user.create({ data: { username: `admin-${code}`, displayName: `Admin ${code}`, passwordHash: await argon2.hash('Pass123!'), status: 'ACTIVE' } });
    await prisma.tenantMembership.create({ data: { tenantId: tenant.id, userId: user.id, role: 'TENANT_ADMIN', status: 'ACTIVE' } });
    await prisma.driver.create({ data: { tenantId: tenant.id, sppgId: sppg.id, code: `D-${code}`, name: `Driver ${code}`, status: 'ACTIVE' } });
    console.log('tenant', tenant.id, 'user', user.username);
    return { tenant, user };
  }

  await makeTenant('A', 'Tenant A');
  await makeTenant('B', 'Tenant B');
}

main().finally(() => prisma.$disconnect());

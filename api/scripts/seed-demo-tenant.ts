import { PrismaClient } from '@prisma/client';
import * as argon2 from 'argon2';

const prisma = new PrismaClient();

async function main() {
  const org = await prisma.organization.findFirst();
  const region = await prisma.region.findFirst({ where: org ? { organizationId: org.id } : undefined });
  if (!org || !region) throw new Error('base data missing');

  const code = 'DEMO';
  const sppg = await prisma.sppg.create({
    data: { organizationId: org.id, regionId: region.id, code, name: 'SPPG Demo', status: 'ACTIVE' },
  });
  const tenant = await prisma.tenant.create({
    data: { tenantCode: `T-${code}`, name: 'SPPG Demo', status: 'ACTIVE', legacySppgId: sppg.id },
  });
  await prisma.sppgProfile.create({
    data: { tenantId: tenant.id, sppgName: 'SPPG Demo', fullAddress: 'Alamat Demo', capacity: 100 },
  });
  const user = await prisma.user.create({
    data: {
      username: 'admin-demo',
      displayName: 'Admin Demo',
      passwordHash: await argon2.hash('DemoPass123!'),
      status: 'ACTIVE',
    },
  });
  await prisma.tenantMembership.create({
    data: { tenantId: tenant.id, userId: user.id, role: 'TENANT_ADMIN', status: 'ACTIVE' },
  });
  await prisma.driver.create({
    data: { tenantId: tenant.id, sppgId: sppg.id, code: 'DRV-DEMO', name: 'Driver Demo', status: 'ACTIVE' },
  });
  await prisma.deliveryLocation.create({
    data: { organizationId: org.id, regionId: region.id, code: 'DL-DEMO', name: 'Lokasi Demo', active: true, tenantId: tenant.id, latitude: -6.2, longitude: 106.8 },
  });
  console.log('Tenant created:', tenant.id);
  console.log('Username: admin-demo');
  console.log('Password: DemoPass123!');
  console.log('Tenant code:', tenant.tenantCode);
}

main().catch((e) => { console.error(e); process.exit(1); }).finally(() => prisma.$disconnect());

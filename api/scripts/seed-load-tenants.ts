// Seed 1000 tenants for load testing (dev/staging only).
import { PrismaClient } from '@prisma/client';
import * as argon2 from 'argon2';

const prisma = new PrismaClient();
const COUNT = Number(process.env.SEED_COUNT || 1000);

async function main() {
  const org = await prisma.organization.findFirst();
  const region = await prisma.region.findFirst({ where: org ? { organizationId: org.id } : undefined });
  if (!org || !region) {
    throw new Error('Organization/Region not found. Seed base data first.');
  }

  const passwordHash = await argon2.hash('LoadTest123!');
  let created = 0;

  for (let i = 1; i <= COUNT; i++) {
    const code = `lt${String(i).padStart(5, '0')}`;
    try {
      const sppg = await prisma.sppg.create({
        data: { organizationId: org.id, regionId: region.id, code, name: `Load Tenant ${code}`, status: 'ACTIVE' },
      });
      const tenant = await prisma.tenant.create({
        data: { tenantCode: `T-${code}`, name: `Load Tenant ${code}`, status: 'ACTIVE', legacySppgId: sppg.id },
      });
      await prisma.sppgProfile.create({
        data: { tenantId: tenant.id, sppgName: `Load Tenant ${code}`, fullAddress: 'Load test address' },
      });
      const user = await prisma.user.create({
        data: {
          username: `admin-${code}`,
          displayName: `Admin ${code}`,
          passwordHash,
          status: 'ACTIVE',
        },
      });
      await prisma.tenantMembership.create({
        data: { tenantId: tenant.id, userId: user.id, role: 'TENANT_ADMIN', status: 'ACTIVE' },
      });
      created++;
      if (i % 100 === 0) console.log(`created ${i}/${COUNT}`);
    } catch (e) {
      console.error(`failed ${code}:`, e instanceof Error ? e.message : e);
    }
  }

  console.log(`done: ${created}/${COUNT} tenants created`);
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());

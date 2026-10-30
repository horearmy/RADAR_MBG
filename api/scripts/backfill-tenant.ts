import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function main() {
  const sppgs = await prisma.sppg.findMany();
  console.log('SPPG count:', sppgs.length);

  for (const s of sppgs) {
    const tenant = await prisma.tenant.upsert({
      where: { legacySppgId: s.id },
      update: { name: s.name },
      create: {
        tenantCode: `SPPG-${s.code}`,
        name: s.name,
        status: s.status === 'ACTIVE' ? 'ACTIVE' : 'PENDING_ACTIVATION',
        legacySppgId: s.id,
      },
    });

    // Backfill tenant_id on tenant-owned tables (nullable)
    await prisma.driver.updateMany({ where: { sppgId: s.id }, data: { tenantId: tenant.id } });
    await prisma.vehicle.updateMany({ where: { sppgId: s.id }, data: { tenantId: tenant.id } });
    await prisma.trip.updateMany({ where: { sppgId: s.id }, data: { tenantId: tenant.id } });
    await prisma.route.updateMany({ where: { sppgId: s.id }, data: { tenantId: tenant.id } });
    await prisma.exceptionCase.updateMany({ where: { sppgId: s.id }, data: { tenantId: tenant.id } });

    // Create sppg profile if not exists
    await prisma.sppgProfile.upsert({
      where: { tenantId: tenant.id },
      update: { sppgName: s.name },
      create: {
        tenantId: tenant.id,
        sppgName: s.name,
        fullAddress: s.address ?? '',
      },
    });

    console.log('tenant ensured:', tenant.id, 'for sppg:', s.id);
  }
}

main().finally(() => prisma.$disconnect());

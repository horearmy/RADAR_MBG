import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function main() {
  const org = await prisma.organization.findFirst();
  const region = await prisma.region.findFirst({ where: org ? { organizationId: org.id } : undefined });
  if (!org || !region) throw new Error('base data missing');

  const tenants = await prisma.tenant.findMany({ where: { name: { startsWith: 'Load Tenant ' } } });
  console.log('tenants', tenants.length);

  let dlCreated = 0, drvCreated = 0;
  for (const t of tenants) {
    const sppgId = t.legacySppgId;
    if (!sppgId) continue;

    // Delivery location
    const dlCode = `DL-${t.tenantCode}`;
    const existingDl = await prisma.deliveryLocation.findFirst({ where: { organizationId: org.id, code: dlCode } });
    if (!existingDl) {
      await prisma.deliveryLocation.create({
        data: { organizationId: org.id, regionId: region.id, code: dlCode, name: `Lokasi ${t.tenantCode}`, active: true, tenantId: t.id },
      });
      dlCreated++;
    }

    // Driver
    const drvCode = `DRV-${t.tenantCode}`;
    const existingDrv = await prisma.driver.findFirst({ where: { sppgId, code: drvCode } });
    if (!existingDrv) {
      await prisma.driver.create({
        data: { tenantId: t.id, sppgId, code: drvCode, name: `Driver ${t.tenantCode}`, status: 'ACTIVE' },
      });
      drvCreated++;
    }
  }

  console.log(`done: deliveryLocations +${dlCreated}, drivers +${drvCreated}`);
}

main().catch((e) => { console.error(e); process.exit(1); }).finally(() => prisma.$disconnect());

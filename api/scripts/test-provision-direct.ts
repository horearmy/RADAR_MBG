import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();
async function main() {
  const id = '28778666-693d-4b8d-8e4a-3e88c75cfa47';
  const reg = await prisma.tenantRegistration.findUnique({ where: { id } });
  console.log('status', reg?.status);
  try {
    const tenant = await prisma.tenant.create({ data: { tenantCode: `SPPG-${reg!.registrationNumber}`, name: reg!.sppgName, status: 'ACTIVE' } });
    console.log('tenant created', tenant.id);
    await prisma.sppgProfile.create({ data: { tenantId: tenant.id, sppgName: reg!.sppgName, fullAddress: reg!.fullAddress, contactPhone: reg!.contactPhone } });
    console.log('profile created');
    const username = reg!.contactEmail || `admin-${reg!.registrationNumber}`;
    const user = await prisma.user.create({ data: { username, displayName: reg!.contactName || 'Admin SPPG', passwordHash: '', status: 'INVITED' } });
    console.log('user created', user.id);
    await prisma.tenantMembership.create({ data: { tenantId: tenant.id, userId: user.id, role: 'TENANT_ADMIN', status: 'INVITED' } });
    console.log('membership created');
    const { createHash, randomBytes } = await import('node:crypto');
    const rawToken = randomBytes(32).toString('base64url');
    const tokenHash = createHash('sha256').update(rawToken).digest('hex');
    await prisma.accountAccessToken.create({ data: { userId: user.id, tokenHash, purpose: 'INVITATION', expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), createdBy: user.id } });
    console.log('token created');
    await prisma.tenantRegistration.update({ where: { id }, data: { tenantId: tenant.id } });
    console.log('registration updated');
  } catch (e: any) {
    console.error('ERROR:', e.message);
    console.error(e);
  }
}
main().finally(() => prisma.$disconnect());

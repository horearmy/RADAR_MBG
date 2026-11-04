import 'dotenv/config';
import { AccountStatus, PrismaClient } from '@prisma/client';
import * as argon2 from 'argon2';
import { encryptMfaSecret, verifyTotp } from '../src/auth/auth.security.js';
import { PERMISSION_CODES } from './rbac-catalog.js';

const prisma = new PrismaClient();

async function bootstrapAdmin() {
  const username = process.env.BOOTSTRAP_ADMIN_USERNAME?.trim().toLowerCase();
  const displayName = process.env.BOOTSTRAP_ADMIN_NAME?.trim();
  const password = process.env.BOOTSTRAP_ADMIN_PASSWORD;
  const totpSecret = process.env.BOOTSTRAP_ADMIN_TOTP_SECRET;
  const totpCode = process.env.BOOTSTRAP_ADMIN_TOTP_CODE;
  const encryptionKey = process.env.MFA_ENCRYPTION_KEY;

  if (!username || !displayName || !password || !totpSecret || !totpCode) {
    throw new Error('Bootstrap identity, password, and MFA values are required');
  }
  if (password.length < 14 || password.length > 128) {
    throw new Error('Bootstrap password must contain 14 to 128 characters');
  }
  if (!encryptionKey || !/^[a-f\d]{64}$/i.test(encryptionKey)) {
    throw new Error('MFA_ENCRYPTION_KEY must be set to a 32-byte hexadecimal key');
  }
  if (!verifyTotp(totpSecret, totpCode)) {
    throw new Error('Bootstrap MFA code is invalid');
  }
  const existingUser = await prisma.user.findUnique({ where: { username }, select: { id: true, status: true } });
  if (existingUser) {
    console.log('User already exists, skipping bootstrap');
    await prisma.$disconnect();
    return;
  }

  const passwordHash = await argon2.hash(password, { type: argon2.argon2id });
  const mfaSecretEncrypted = encryptMfaSecret(totpSecret, encryptionKey);
  const permissions = PERMISSION_CODES;

  await prisma.$transaction(async (tx) => {
    const role = await tx.role.upsert({
      where: { code: 'SUPERADMIN' },
      update: { isGlobal: true, requiresMfa: true, active: true },
      create: {
        code: 'SUPERADMIN',
        name: 'Superadmin',
        description: 'Akses global platform RADAR MBG',
        isGlobal: true,
        requiresMfa: true,
      },
    });
    const user = await tx.user.create({
      data: {
        username,
        displayName,
        passwordHash,
        status: AccountStatus.ACTIVE,
        mfaEnabled: true,
        mfaSecretEncrypted,
        passwordChangedAt: new Date(),
      },
    });

    for (const code of permissions) {
      const permission = await tx.permission.upsert({
        where: { code },
        update: {},
        create: { code },
      });
      await tx.rolePermission.upsert({
        where: {
          roleId_permissionId: { roleId: role.id, permissionId: permission.id },
        },
        update: {},
        create: { roleId: role.id, permissionId: permission.id },
      });
    }

    await tx.userRole.create({
      data: { userId: user.id, roleId: role.id },
    });
  });

  console.info('Superadmin bootstrap completed. Keep MFA recovery material outside this application.');
}

bootstrapAdmin()
  .catch(() => {
    console.error('Superadmin bootstrap failed. Verify configuration and database availability.');
    process.exitCode = 1;
  })
  .finally(async () => prisma.$disconnect());

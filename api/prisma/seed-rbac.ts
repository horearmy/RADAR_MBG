import 'dotenv/config';
import { PrismaClient } from '@prisma/client';
import { PERMISSION_CODES, ROLE_DEFINITIONS } from './rbac-catalog.js';

const prisma = new PrismaClient();

async function seedRbac() {
  await prisma.$transaction(async (tx) => {
    for (const code of PERMISSION_CODES) {
      await tx.permission.upsert({
        where: { code },
        update: {},
        create: { code },
      });
    }

    for (const definition of ROLE_DEFINITIONS) {
      const role = await tx.role.upsert({
        where: { code: definition.code },
        update: {
          name: definition.name,
          description: definition.description,
          isGlobal: definition.isGlobal,
          requiresMfa: definition.requiresMfa,
          active: true,
        },
        create: {
          code: definition.code,
          name: definition.name,
          description: definition.description,
          isGlobal: definition.isGlobal,
          requiresMfa: definition.requiresMfa,
        },
      });

      for (const permissionCode of definition.permissions) {
        const permission = await tx.permission.findUniqueOrThrow({
          where: { code: permissionCode },
          select: { id: true },
        });
        await tx.rolePermission.upsert({
          where: {
            roleId_permissionId: { roleId: role.id, permissionId: permission.id },
          },
          update: {},
          create: { roleId: role.id, permissionId: permission.id },
        });
      }
    }
  });

  console.info('RBAC catalog seeded. No user accounts or passwords were created.');
}

seedRbac()
  .catch(() => {
    console.error('RBAC seed failed. Verify database availability and migration state.');
    process.exitCode = 1;
  })
  .finally(async () => prisma.$disconnect());

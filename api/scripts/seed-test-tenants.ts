// Seed two tenants for cross-tenant tests (dev only).
import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function main() {
  // Create two SPPG + tenants (reuse backfill logic conceptually)
  console.log('Seed test tenants placeholder');
}

main().finally(() => prisma.$disconnect());

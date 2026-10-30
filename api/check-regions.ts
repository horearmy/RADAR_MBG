import 'dotenv/config';
import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();
prisma.region.findMany().then(r => { console.log(JSON.stringify(r, null, 2)); return prisma.$disconnect(); }).catch(e => { console.error(e); process.exit(1); });

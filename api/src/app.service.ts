import { Injectable } from '@nestjs/common';
import { PrismaService } from './database/prisma.service.js';

@Injectable()
export class AppService {
  constructor(private readonly prisma: PrismaService) {}

  async getHealth() {
    const database = await this.prisma.checkDatabase();
    return {
      status: database === 'unavailable' ? 'degraded' : 'ok',
      service: 'radar-mbg-api',
      checkedAt: new Date().toISOString(),
      uptimeSeconds: Math.floor(process.uptime()),
      checks: {
        api: 'ok',
        database,
      },
    };
  }
}

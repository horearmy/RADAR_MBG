import { Injectable, OnModuleDestroy } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';

export type DatabaseHealth = 'ok' | 'not_configured' | 'unavailable';

@Injectable()
export class PrismaService implements OnModuleDestroy {
  private readonly client: PrismaClient | null;

  constructor() {
    const baseUrl = process.env.DATABASE_URL;
    if (!baseUrl) {
      this.client = null;
      return;
    }
    const limit = Number(process.env.DB_CONNECTION_LIMIT ?? 20);
    const url = baseUrl.includes('connection_limit=')
      ? baseUrl
      : `${baseUrl}${baseUrl.includes('?') ? '&' : '?'}connection_limit=${limit}`;
    this.client = new PrismaClient({ datasources: { db: { url } } });
  }

  get db(): PrismaClient {
    if (!this.client) {
      throw new Error('DATABASE_URL is required for database operations');
    }
    return this.client;
  }

  async checkDatabase(): Promise<DatabaseHealth> {
    if (!this.client) return 'not_configured';

    try {
      await this.client.$queryRaw`SELECT 1`;
      return 'ok';
    } catch {
      return 'unavailable';
    }
  }

  async onModuleDestroy() {
    await this.client?.$disconnect();
  }
}

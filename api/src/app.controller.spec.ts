import { Test, TestingModule } from '@nestjs/testing';
import { AppController } from './app.controller.js';
import { AppService } from './app.service.js';
import { PrismaService } from './database/prisma.service.js';

describe('AppController', () => {
  let appController: AppController;
  let prisma: { checkDatabase: ReturnType<typeof vi.fn> };

  beforeEach(async () => {
    prisma = { checkDatabase: vi.fn().mockResolvedValue('not_configured') };
    const app: TestingModule = await Test.createTestingModule({
      controllers: [AppController],
      providers: [
        AppService,
        { provide: PrismaService, useValue: prisma },
      ],
    }).compile();

    appController = app.get<AppController>(AppController);
  });

  describe('health', () => {
    it('reports API health without claiming database availability', () => {
      return expect(appController.getHealth()).resolves.toMatchObject({
        status: 'ok',
        service: 'radar-mbg-api',
        checks: { api: 'ok', database: 'not_configured' },
      });
    });

    it('marks the service degraded when the configured database is unavailable', async () => {
      prisma.checkDatabase.mockResolvedValue('unavailable');

      await expect(appController.getHealth()).resolves.toMatchObject({
        status: 'degraded',
        checks: { api: 'ok', database: 'unavailable' },
      });
    });
  });
});

// Cross-tenant negative tests (e2e skeleton).
// Requires seeded DB (run seed-cross-tenant.ts) and two tenant admins.
import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { AppModule } from './../src/app.module.js';

describe('cross-tenant negative (e2e)', () => {
  let app: INestApplication;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = moduleFixture.createNestApplication();
    await app.init();
  });

  afterAll(async () => { await app.close(); });

  it('tenant A cannot read tenant B driver (placeholder)', async () => {
    // TODO: login as tenant A, fetch /admin/drivers with tenant B driver id, expect 404/403.
    expect(true).toBe(true);
  });
});

import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import cookieParser from 'cookie-parser';
import request from 'supertest';
import { App } from 'supertest/types.js';
import { AppModule } from './../src/app.module.js';
import { createCsrfMiddleware } from './../src/auth/csrf.middleware.js';

describe('AppController (e2e)', () => {
  let app: INestApplication<App>;
  let originalDatabaseUrl: string | undefined;

  beforeEach(async () => {
    originalDatabaseUrl = process.env.DATABASE_URL;
    delete process.env.DATABASE_URL;

    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    app.setGlobalPrefix('api/v1');
    app.use(cookieParser());
    app.use(createCsrfMiddleware());
    await app.init();
  });

  it('/api/v1/health (GET)', async () => {
    const response = await request(app.getHttpServer())
      .get('/api/v1/health')
      .expect(200);

    expect(response.body).toMatchObject({
      status: 'ok',
      service: 'radar-mbg-api',
      checks: { api: 'ok', database: 'not_configured' },
    });
    expect(response.body.checkedAt).toBeTruthy();
  });

  it('/api/v1/auth/csrf (GET) issues a no-store CSRF token', async () => {
    const response = await request(app.getHttpServer())
      .get('/api/v1/auth/csrf')
      .expect(200);

    expect(response.body.csrfToken).toMatch(/^[a-f\d]{64}$/);
    expect(response.headers['cache-control']).toBe('no-store');
    expect(response.headers['set-cookie'][0]).toContain('radar_csrf=');
  });

  it('/api/v1/auth/login (POST) rejects a request without CSRF proof', async () => {
    await request(app.getHttpServer())
      .post('/api/v1/auth/login')
      .set('Origin', 'http://localhost:3000')
      .send({ username: 'driver', password: 'not-a-real-password' })
      .expect(403)
      .expect(({ body }) => {
        expect(body).toMatchObject({ code: 'CSRF_INVALID' });
      });
  });

  it('/api/v1/auth/me (GET) requires a valid session', async () => {
    await request(app.getHttpServer())
      .get('/api/v1/auth/me')
      .expect(401)
      .expect(({ body }) => {
        expect(body).toMatchObject({ code: 'UNAUTHENTICATED' });
    });
  });

  it('/api/v1/trips (GET) requires authentication before querying trip data', async () => {
    await request(app.getHttpServer())
      .get('/api/v1/trips')
      .expect(401)
      .expect(({ body }) => {
        expect(body).toMatchObject({ code: 'UNAUTHENTICATED' });
    });
  });

  it('/api/v1/trips (POST) requires CSRF proof and an authenticated session', async () => {
    await request(app.getHttpServer())
      .post('/api/v1/trips')
      .set('Origin', 'http://localhost:3000')
      .set('Cookie', 'radar_csrf=test-token')
      .set('x-csrf-token', 'test-token')
      .send({})
      .expect(401)
      .expect(({ body }) => {
        expect(body).toMatchObject({ code: 'UNAUTHENTICATED' });
      });
  });

  it('/api/v1/trips/:id/track (GET) requires an authenticated scoped session', async () => {
    await request(app.getHttpServer())
      .get('/api/v1/trips/00000000-0000-4000-8000-000000000001/track')
      .expect(401)
      .expect(({ body }) => {
        expect(body).toMatchObject({ code: 'UNAUTHENTICATED' });
      });
  });

  it('/api/v1/trips/:id/locations (POST) requires CSRF and authentication', async () => {
    await request(app.getHttpServer())
      .post('/api/v1/trips/00000000-0000-4000-8000-000000000001/locations')
      .set('Origin', 'http://localhost:3000')
      .set('Cookie', 'radar_csrf=test-token')
      .set('x-csrf-token', 'test-token')
      .send({})
      .expect(401)
      .expect(({ body }) => {
        expect(body).toMatchObject({ code: 'UNAUTHENTICATED' });
      });
  });

  it('/api/v1/geofences (GET) requires an authenticated scoped session', async () => {
    await request(app.getHttpServer())
      .get('/api/v1/geofences?locationType=DELIVERY&locationId=00000000-0000-4000-8000-000000000001')
      .expect(401)
      .expect(({ body }) => {
        expect(body).toMatchObject({ code: 'UNAUTHENTICATED' });
      });
  });

  it('/api/v1/geofences (POST) requires CSRF and an authenticated session', async () => {
    await request(app.getHttpServer())
      .post('/api/v1/geofences')
      .set('Origin', 'http://localhost:3000')
      .set('Cookie', 'radar_csrf=test-token')
      .set('x-csrf-token', 'test-token')
      .set('Idempotency-Key', 'geofence-create-001')
      .send({})
      .expect(401)
      .expect(({ body }) => {
        expect(body).toMatchObject({ code: 'UNAUTHENTICATED' });
      });
  });

  it('/api/v1/trips/:id/qr-token requires CSRF and an authenticated session', async () => {
    await request(app.getHttpServer())
      .post('/api/v1/trips/00000000-0000-4000-8000-000000000001/qr-token')
      .set('Origin', 'http://localhost:3000')
      .set('Cookie', 'radar_csrf=test-token')
      .set('x-csrf-token', 'test-token')
      .send({ expiresInSeconds: 300 })
      .expect(401)
      .expect(({ body }) => {
        expect(body).toMatchObject({ code: 'UNAUTHENTICATED' });
      });
  });

  it('/api/v1/trips/:id/arrival/verify requires CSRF and authentication', async () => {
    await request(app.getHttpServer())
      .post('/api/v1/trips/00000000-0000-4000-8000-000000000001/arrival/verify')
      .set('Origin', 'http://localhost:3000')
      .set('Cookie', 'radar_csrf=test-token')
      .set('x-csrf-token', 'test-token')
      .set('Idempotency-Key', 'arrival-attempt-001')
      .send({})
      .expect(401)
      .expect(({ body }) => {
        expect(body).toMatchObject({ code: 'UNAUTHENTICATED' });
      });
  });

  it('/api/v1/trips/:id/arrival/override requires CSRF and authentication', async () => {
    await request(app.getHttpServer())
      .post('/api/v1/trips/00000000-0000-4000-8000-000000000001/arrival/override')
      .set('Origin', 'http://localhost:3000')
      .set('Cookie', 'radar_csrf=test-token')
      .set('x-csrf-token', 'test-token')
      .set('Idempotency-Key', 'arrival-override-001')
      .send({})
      .expect(401)
      .expect(({ body }) => {
        expect(body).toMatchObject({ code: 'UNAUTHENTICATED' });
      });
  });

  it('/api/v1/trips/:id/delivery/start requires an authenticated session', async () => {
    await request(app.getHttpServer())
      .post('/api/v1/trips/00000000-0000-4000-8000-000000000001/delivery/start')
      .set('Origin', 'http://localhost:3000')
      .set('Cookie', 'radar_csrf=test-token')
      .set('x-csrf-token', 'test-token')
      .set('Idempotency-Key', 'delivery-start-001')
      .send({})
      .expect(401)
      .expect(({ body }) => {
        expect(body).toMatchObject({ code: 'UNAUTHENTICATED' });
      });
  });

  it('/api/v1/trips/:id/complete requires an authenticated session', async () => {
    await request(app.getHttpServer())
      .post('/api/v1/trips/00000000-0000-4000-8000-000000000001/complete')
      .set('Origin', 'http://localhost:3000')
      .set('Cookie', 'radar_csrf=test-token')
      .set('x-csrf-token', 'test-token')
      .set('Idempotency-Key', 'trip-complete-001')
      .send({})
      .expect(401)
      .expect(({ body }) => {
        expect(body).toMatchObject({ code: 'UNAUTHENTICATED' });
      });
  });

  it('/api/v1/trips/:id/delivery (POST) requires CSRF and authentication', async () => {
    await request(app.getHttpServer())
      .post('/api/v1/trips/00000000-0000-4000-8000-000000000001/delivery')
      .set('Origin', 'http://localhost:3000')
      .set('Cookie', 'radar_csrf=test-token')
      .set('x-csrf-token', 'test-token')
      .set('Idempotency-Key', 'pod-submit-0001')
      .send({ receivedQuantity: 100 })
      .expect(401)
      .expect(({ body }) => {
        expect(body).toMatchObject({ code: 'UNAUTHENTICATED' });
      });
  });

  it('/api/v1/trips/:id/delivery/review requires CSRF and authentication', async () => {
    await request(app.getHttpServer())
      .post('/api/v1/trips/00000000-0000-4000-8000-000000000001/delivery/review')
      .set('Origin', 'http://localhost:3000')
      .set('Cookie', 'radar_csrf=test-token')
      .set('x-csrf-token', 'test-token')
      .set('Idempotency-Key', 'pod-review-0001')
      .send({ decision: 'ACCEPT', reason: 'Jumlah telah diverifikasi.' })
      .expect(401)
      .expect(({ body }) => {
        expect(body).toMatchObject({ code: 'UNAUTHENTICATED' });
      });
  });

  it('/api/v1/admin/organizations (GET) requires an authenticated session', async () => {
    await request(app.getHttpServer())
      .get('/api/v1/admin/organizations')
      .expect(401)
      .expect(({ body }) => {
        expect(body).toMatchObject({ code: 'UNAUTHENTICATED' });
      });
  });

  it('/api/v1/admin/sppg (POST) requires CSRF proof and an authenticated session', async () => {
    await request(app.getHttpServer())
      .post('/api/v1/admin/sppg')
      .set('Origin', 'http://localhost:3000')
      .set('Cookie', 'radar_csrf=test-token')
      .set('x-csrf-token', 'test-token')
      .send({})
      .expect(401)
      .expect(({ body }) => {
        expect(body).toMatchObject({ code: 'UNAUTHENTICATED' });
      });
  });

  it('/api/v1/admin/vehicles/:id (PATCH) requires CSRF proof and an authenticated session', async () => {
    await request(app.getHttpServer())
      .patch('/api/v1/admin/vehicles/00000000-0000-4000-8000-000000000001')
      .set('Origin', 'http://localhost:3000')
      .set('Cookie', 'radar_csrf=test-token')
      .set('x-csrf-token', 'test-token')
      .send({ status: 'MAINTENANCE', reason: 'Servis berkala.' })
      .expect(401)
      .expect(({ body }) => {
        expect(body).toMatchObject({ code: 'UNAUTHENTICATED' });
      });
  });

  it('/api/v1/trips/:id/schedule (PATCH) requires CSRF proof and an authenticated session', async () => {
    await request(app.getHttpServer())
      .patch('/api/v1/trips/00000000-0000-4000-8000-000000000001/schedule')
      .set('Origin', 'http://localhost:3000')
      .set('Cookie', 'radar_csrf=test-token')
      .set('x-csrf-token', 'test-token')
      .set('Idempotency-Key', 'trip-reschedule-001')
      .send({})
      .expect(401)
      .expect(({ body }) => {
        expect(body).toMatchObject({ code: 'UNAUTHENTICATED' });
      });
  });

  it('/api/v1/trips/:id/assignment (PATCH) requires CSRF proof and an authenticated session', async () => {
    await request(app.getHttpServer())
      .patch('/api/v1/trips/00000000-0000-4000-8000-000000000001/assignment')
      .set('Origin', 'http://localhost:3000')
      .set('Cookie', 'radar_csrf=test-token')
      .set('x-csrf-token', 'test-token')
      .set('Idempotency-Key', 'trip-reassign-001')
      .send({})
      .expect(401)
      .expect(({ body }) => {
        expect(body).toMatchObject({ code: 'UNAUTHENTICATED' });
      });
  });

  it('/api/v1/trips/:id/destination (PATCH) requires CSRF proof and an authenticated session', async () => {
    await request(app.getHttpServer())
      .patch('/api/v1/trips/00000000-0000-4000-8000-000000000001/destination')
      .set('Origin', 'http://localhost:3000')
      .set('Cookie', 'radar_csrf=test-token')
      .set('x-csrf-token', 'test-token')
      .set('Idempotency-Key', 'trip-destination-001')
      .send({})
      .expect(401)
      .expect(({ body }) => {
        expect(body).toMatchObject({ code: 'UNAUTHENTICATED' });
      });
  });

  it('/api/v1/trips/:id/cancel (POST) requires CSRF proof and an authenticated session', async () => {
    await request(app.getHttpServer())
      .post('/api/v1/trips/00000000-0000-4000-8000-000000000001/cancel')
      .set('Origin', 'http://localhost:3000')
      .set('Cookie', 'radar_csrf=test-token')
      .set('x-csrf-token', 'test-token')
      .set('Idempotency-Key', 'trip-cancel-0001')
      .send({})
      .expect(401)
      .expect(({ body }) => {
        expect(body).toMatchObject({ code: 'UNAUTHENTICATED' });
      });
  });

  it('/api/v1/admin/assignments (POST) requires CSRF proof and an authenticated session', async () => {
    await request(app.getHttpServer())
      .post('/api/v1/admin/assignments')
      .set('Origin', 'http://localhost:3000')
      .set('Cookie', 'radar_csrf=test-token')
      .set('x-csrf-token', 'test-token')
      .send({})
      .expect(401)
      .expect(({ body }) => {
        expect(body).toMatchObject({ code: 'UNAUTHENTICATED' });
      });
  });

  it('/api/v1/exceptions (GET) requires an authenticated session', async () => {
    await request(app.getHttpServer())
      .get('/api/v1/exceptions')
      .expect(401)
      .expect(({ body }) => {
        expect(body).toMatchObject({ code: 'UNAUTHENTICATED' });
      });
  });

  it('/api/v1/exceptions (POST) requires CSRF proof and an authenticated session', async () => {
    await request(app.getHttpServer())
      .post('/api/v1/exceptions')
      .set('Origin', 'http://localhost:3000')
      .set('Cookie', 'radar_csrf=test-token')
      .set('x-csrf-token', 'test-token')
      .send({})
      .expect(401)
      .expect(({ body }) => {
        expect(body).toMatchObject({ code: 'UNAUTHENTICATED' });
      });
  });

  it('/api/v1/trips/:id/delivery/proofs (POST) requires CSRF proof and an authenticated session', async () => {
    await request(app.getHttpServer())
      .post('/api/v1/trips/00000000-0000-4000-8000-000000000001/delivery/proofs')
      .set('Origin', 'http://localhost:3000')
      .set('Cookie', 'radar_csrf=test-token')
      .set('x-csrf-token', 'test-token')
      .attach('file', Buffer.from('proof'), 'proof.jpg')
      .expect(401)
      .expect(({ body }) => {
        expect(body).toMatchObject({ code: 'UNAUTHENTICATED' });
      });
  });

  it('/api/v1/trips/:id/delivery/proofs (GET) requires an authenticated session', async () => {
    await request(app.getHttpServer())
      .get('/api/v1/trips/00000000-0000-4000-8000-000000000001/delivery/proofs')
      .expect(401)
      .expect(({ body }) => {
        expect(body).toMatchObject({ code: 'UNAUTHENTICATED' });
      });
  });

  afterEach(async () => {
    await app.close();
    if (originalDatabaseUrl === undefined) {
      delete process.env.DATABASE_URL;
    } else {
      process.env.DATABASE_URL = originalDatabaseUrl;
    }
  });
});

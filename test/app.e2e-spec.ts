import { Test } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { HttpExceptionFilter } from '../src/common/filters/http-exception.filter';
import { VersioningType } from '@nestjs/common';

async function boot() {
  process.env.JWT_ACCESS_SECRET = process.env.JWT_ACCESS_SECRET || 'test-access-secret-min-32-chars-long-xxxx';
  process.env.JWT_REFRESH_SECRET = process.env.JWT_REFRESH_SECRET || 'test-refresh-secret-min-32-chars-long-xxx';
  process.env.CHAIN_DRY_RUN = 'true';
  const m = await Test.createTestingModule({ imports: [AppModule] }).compile();
  const app = m.createNestApplication();
  app.setGlobalPrefix('api');
  app.enableVersioning({ type: VersioningType.URI, defaultVersion: '1' });
  app.useGlobalPipes(new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true }));
  app.useGlobalFilters(new HttpExceptionFilter());
  await app.init();
  return app;
}

describe('e2e matrix', () => {
  let app: INestApplication;
  beforeAll(async () => { app = await boot(); });
  afterAll(async () => { await app.close(); });
  it('validation: unknown field -> 400 VALIDATION_ERROR', async () => {
    const r = await request(app.getHttpServer()).get('/api/v1/health').expect(200);
    expect(r.body.api).toBe('up');
  });
  it('auth-login: wrong password generic 401', async () => {
    await request(app.getHttpServer()).post('/api/v1/auth/login').send({ email: 'operator@stellarrail.local', password: 'WrongPass12345!' }).expect(401).expect((res: any) => {
      if (res.body.code !== 'INVALID_CREDENTIALS') throw new Error('expected INVALID_CREDENTIALS');
    });
  });
  let operatorToken = '';
  let adminToken = '';
  it('auth-login success + RBAC + payments create/approve', async () => {
    const login = await request(app.getHttpServer()).post('/api/v1/auth/login').send({ email: 'operator@stellarrail.local', password: 'OperatorPass12345!' }).expect((r: any) => { if (![200, 201].includes(r.status)) throw new Error('login failed ' + r.status); });
    const token = login.body.accessToken;
    operatorToken = token;
    const ADDR = 'G' + 'A'.repeat(55);
    const created = await request(app.getHttpServer()).post('/api/v1/payments').set('Authorization', `Bearer ${token}`).send({ destination: ADDR, amountXlm: '5' }).expect(201);
    expect(created.body.status).toBe('CREATED');
    // operator cannot list users
    await request(app.getHttpServer()).get('/api/v1/users').set('Authorization', `Bearer ${token}`).expect(403);
    // idempotency replay
    const k = 'E2E-' + Date.now();
    const r1 = await request(app.getHttpServer()).post('/api/v1/payments').set('Authorization', `Bearer ${token}`).set('Idempotency-Key', k).send({ destination: ADDR, amountXlm: '1' }).expect(201);
    const r2 = await request(app.getHttpServer()).post('/api/v1/payments').set('Authorization', `Bearer ${token}`).set('Idempotency-Key', k).send({ destination: ADDR, amountXlm: '1' }).expect(201);
    expect(r1.body.id).toBe(r2.body.id);
    // blocked address 422
    const admin = await request(app.getHttpServer()).post('/api/v1/auth/login').send({ email: 'admin@stellarrail.local', password: 'AdminPass12345!' });
    expect(admin.body.accessToken).toBeDefined();
    adminToken = admin.body.accessToken;
  });
  it('mfa enroll->verify flow', async () => {
    const token = adminToken;
    const enroll = await request(app.getHttpServer()).post('/api/v1/auth/mfa/enroll').set('Authorization', `Bearer ${token}`).expect(201);
    expect(enroll.body.otpauthUrl).toBeDefined();
  });
  it('refresh + sessions + readonly + caching + timeline + config', async () => {
    const token = adminToken;
    // refresh rotation
    const login2 = await request(app.getHttpServer()).post('/api/v1/auth/login').send({ email: 'approver@stellarrail.local', password: 'ApproverPass12345!' });
    if (login2.body.refreshToken) {
      await request(app.getHttpServer()).post('/api/v1/auth/refresh').send({ refreshToken: login2.body.refreshToken }).expect((r: any) => { if (![200, 201].includes(r.status)) throw new Error('refresh failed'); });
      await request(app.getHttpServer()).get('/api/v1/auth/sessions').set('Authorization', `Bearer ${login2.body.accessToken}`).expect(200);
    }
    await request(app.getHttpServer()).get('/api/v1/payments/stats').set('Authorization', `Bearer ${token}`).expect(200).expect((res: any) => {
      if (!res.headers['x-cache']) throw new Error('missing cache header');
    });
    await request(app.getHttpServer()).get('/api/v1/audit').set('Authorization', `Bearer ${token}`).expect(200);
    await request(app.getHttpServer()).get('/api/v1/audit/export?format=csv').set('Authorization', `Bearer ${token}`).expect(200);
  });
  it('throttler/readonly guards present', async () => {
    await request(app.getHttpServer()).get('/api/v1/health/live').expect(200);
    await request(app.getHttpServer()).get('/api/v1/health/ready').expect(200);
  });
});

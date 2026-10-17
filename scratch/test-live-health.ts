import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import request from 'supertest';
import { AppModule } from '../src/app.module';

async function testLiveHealthEndpoints() {
  console.log('================================================================');
  console.log('🩺 TESTING LIVE /health AND /health/db ENDPOINTS');
  console.log('================================================================\n');

  const moduleFixture: TestingModule = await Test.createTestingModule({
    imports: [AppModule],
  }).compile();

  const app: INestApplication = moduleFixture.createNestApplication();
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      transform: true,
    }),
  );
  await app.init();
  const server = app.getHttpServer();

  try {
    console.log('▶ [1/2] Querying GET /health (Overall System & DB Health)...');
    const sysRes = await request(server).get('/health');
    console.log(`  HTTP Status: ${sysRes.status}`);
    console.log('  Response Payload:\n', JSON.stringify(sysRes.body, null, 2));

    if (sysRes.status !== 200 || sysRes.body.status !== 'UP') {
      throw new Error(`GET /health failed: ${JSON.stringify(sysRes.body)}`);
    }

    console.log('\n▶ [2/2] Querying GET /health/db (Dedicated DB Health Metrics)...');
    const dbRes = await request(server).get('/health/db');
    console.log(`  HTTP Status: ${dbRes.status}`);
    console.log('  Response Payload:\n', JSON.stringify(dbRes.body, null, 2));

    if (dbRes.status !== 200 || dbRes.body.status !== 'UP') {
      throw new Error(`GET /health/db failed: ${JSON.stringify(dbRes.body)}`);
    }

    console.log('\n================================================================');
    console.log('🎉 LIVE DATABASE & SYSTEM HEALTH ENDPOINTS VERIFIED 100%!');
    console.log('================================================================');
  } finally {
    await app.close();
  }
}

testLiveHealthEndpoints().catch((err) => {
  console.error('\n❌ HEALTH ENDPOINT TEST FAILED:', err);
  process.exit(1);
});

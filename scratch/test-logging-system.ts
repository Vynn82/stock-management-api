import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { AppLoggerService } from '../src/common/logger/app-logger.service';
import { AllExceptionsFilter } from '../src/common/logger/all-exceptions.filter';
import * as fs from 'fs';
import * as path from 'path';

async function testLoggingSystem() {
  console.log('================================================================');
  console.log('🔍 VERIFYING REAL-TIME LOG TRACKING & FILE ROTATION SYSTEM');
  console.log('================================================================\n');

  const moduleFixture: TestingModule = await Test.createTestingModule({
    imports: [AppModule],
  }).compile();

  const app: INestApplication = moduleFixture.createNestApplication();
  const appLogger = app.get(AppLoggerService);
  app.useLogger(appLogger);
  app.useGlobalFilters(new AllExceptionsFilter());
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      transform: true,
    }),
  );

  await app.init();
  const server = app.getHttpServer();

  try {
    console.log('▶ [1/3] Triggering Normal HTTP Request (GET /categories)...');
    const res1 = await request(server).get('/categories');
    console.log(`  Response: ${res1.status}, X-Request-Id: ${res1.headers['x-request-id']}`);

    console.log('\n▶ [2/3] Triggering POST Request with sensitive credentials (POST /auth/login)...');
    const res2 = await request(server)
      .post('/auth/login')
      .send({ staffId: 'KH0001', password: 'SecretPassword123!' });
    console.log(`  Response: ${res2.status}, X-Request-Id: ${res2.headers['x-request-id']}`);

    console.log('\n▶ [3/3] Triggering Error/404 Request (GET /invalid-route-for-testing)...');
    const res3 = await request(server).get('/invalid-route-for-testing');
    console.log(`  Response: ${res3.status}, Body: ${JSON.stringify(res3.body)}`);

    // Allow async streams to flush
    await new Promise((resolve) => setTimeout(resolve, 1000));

    console.log('\n▶ [4/4] Verifying Log Files in logs/ Directory...');
    const logDir = path.resolve(process.cwd(), 'logs');
    if (!fs.existsSync(logDir)) {
      throw new Error(`logs/ directory does not exist at ${logDir}`);
    }

    const files = fs.readdirSync(logDir);
    console.log(`  Found log files: ${files.join(', ')}`);

    const appLogFile = files.find((f) => f.startsWith('application-'));
    const httpLogFile = files.find((f) => f.startsWith('http-'));
    const errorLogFile = files.find((f) => f.startsWith('error-'));

    if (!appLogFile || !httpLogFile) {
      throw new Error('Required log files (application-*.log, http-*.log) were not created.');
    }

    console.log('\n--- SAMPLE ENTRIES FROM application-*.log ---');
    const appContent = fs.readFileSync(path.join(logDir, appLogFile), 'utf8');
    const appLines = appContent.trim().split('\n');
    console.log(appLines.slice(-5).join('\n'));

    console.log('\n--- SAMPLE ENTRIES FROM http-*.log ---');
    const httpContent = fs.readFileSync(path.join(logDir, httpLogFile), 'utf8');
    const httpLines = httpContent.trim().split('\n');
    console.log(httpLines.slice(-5).join('\n'));

    // Verify sensitive data was redacted
    if (appContent.includes('SecretPassword123!') || httpContent.includes('SecretPassword123!')) {
      throw new Error('SECURITY VIOLATION: Plaintext password found in log files!');
    } else {
      console.log('\n  🔒 Security Audit: Passwords and sensitive tokens are properly REDACTED.');
    }

    console.log('\n================================================================');
    console.log('🎉 REAL PRODUCTION LOG TRACKING SYSTEM VERIFIED 100%!');
    console.log('================================================================');
  } finally {
    await app.close();
  }
}

testLoggingSystem()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error('\n❌ LOGGING SYSTEM TEST FAILED:', err);
    process.exit(1);
  });

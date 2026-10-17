import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { ValidationPipe } from '@nestjs/common';
import { AppLoggerService } from './common/logger/app-logger.service';
import { AllExceptionsFilter } from './common/logger/all-exceptions.filter';

async function bootstrap() {
  const app = await NestFactory.create(AppModule, {
    bufferLogs: true,
  });

  const appLogger = app.get(AppLoggerService);
  app.useLogger(appLogger);

  app.useGlobalFilters(new AllExceptionsFilter());

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      transform: true,
    }),
  );

  app.enableCors({
    origin: (origin, callback) => {
      // Allow requests with no origin (like mobile apps, curl, or telegram webhook)
      if (!origin) return callback(null, true);

      const allowedOrigins = [
        'http://localhost:8200',
        'http://127.0.0.1:8200',
        'http://localhost:3000',
        'http://127.0.0.1:3000',
        'http://localhost:3001',
        'http://127.0.0.1:3001',
      ];

      // Allow configured Telegram Mini App URL origin
      let miniAppOrigin: string | null = null;
      if (process.env.TELEGRAM_MINI_APP_URL) {
        try {
          miniAppOrigin = new URL(process.env.TELEGRAM_MINI_APP_URL).origin;
        } catch {
          miniAppOrigin = process.env.TELEGRAM_MINI_APP_URL.replace(/\/+$/, '');
        }
      }

      // Allow dynamically configured CORS origins from .env
      const customOrigins = (process.env.CORS_ORIGINS || '')
        .split(',')
        .map((item) => item.trim())
        .filter(Boolean)
        .map((item) => {
          try {
            return new URL(item).origin;
          } catch {
            return item.replace(/\/+$/, '');
          }
        });

      if (
        allowedOrigins.includes(origin) ||
        (miniAppOrigin && origin === miniAppOrigin) ||
        customOrigins.includes(origin) ||
        process.env.NODE_ENV !== 'production' ||
        origin.endsWith('.onrender.com') ||
        origin.endsWith('.vercel.app') ||
        origin.endsWith('.netlify.app') ||
        origin.endsWith('.ngrok-free.app') ||
        origin.endsWith('.ngrok.io') ||
        origin.endsWith('.ngrok.app') ||
        origin.endsWith('.loca.lt')
      ) {
        return callback(null, true);
      }
      return callback(new Error('Not allowed by CORS'));
    },
    methods: 'GET,HEAD,PUT,PATCH,POST,DELETE,OPTIONS',
    credentials: true,
  });

  await app.listen(process.env.PORT ?? 3000);
}
void bootstrap();

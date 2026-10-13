import { Global, Module } from '@nestjs/common';
import { AppLoggerService } from './app-logger.service';
import { HttpLoggerMiddleware } from './http-logger.middleware';

@Global()
@Module({
  providers: [AppLoggerService, HttpLoggerMiddleware],
  exports: [AppLoggerService, HttpLoggerMiddleware],
})
export class LoggerModule {}

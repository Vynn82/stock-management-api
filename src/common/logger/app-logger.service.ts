import { Injectable, LoggerService } from '@nestjs/common';
import { winstonLogger } from './winston.config';

@Injectable()
export class AppLoggerService implements LoggerService {
  log(message: any, context?: string) {
    winstonLogger.info(this.formatMessage(message), { context });
  }

  error(message: any, trace?: string, context?: string, requestId?: string) {
    winstonLogger.error(this.formatMessage(message), {
      context,
      stack: trace,
      requestId,
    });
  }

  warn(message: any, context?: string) {
    winstonLogger.warn(this.formatMessage(message), { context });
  }

  debug(message: any, context?: string) {
    winstonLogger.debug(this.formatMessage(message), { context });
  }

  verbose(message: any, context?: string) {
    winstonLogger.debug(this.formatMessage(message), { context });
  }

  http(message: any, meta?: Record<string, any>) {
    winstonLogger.http(this.formatMessage(message), meta);
  }

  private formatMessage(message: any): string {
    if (typeof message === 'object') {
      try {
        return JSON.stringify(message);
      } catch {
        return String(message);
      }
    }
    return String(message);
  }
}

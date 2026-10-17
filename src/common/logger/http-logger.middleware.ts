import { Injectable, NestMiddleware } from '@nestjs/common';
import { Request, Response, NextFunction } from 'express';
import { randomUUID } from 'crypto';
import { winstonLogger } from './winston.config';

@Injectable()
export class HttpLoggerMiddleware implements NestMiddleware {
  use(req: Request, res: Response, next: NextFunction) {
    const start = Date.now();

    // 1. Establish unique Request ID for end-to-end tracing
    const requestId = (req.headers['x-request-id'] as string) || randomUUID();
    (req as any).requestId = requestId;
    res.setHeader('X-Request-Id', requestId);

    // 2. Intercept response completion to log execution metrics
    res.on('finish', () => {
      const duration = Date.now() - start;
      const { method, originalUrl, ip } = req;
      const statusCode = res.statusCode;
      const userAgent = req.get('user-agent') || '-';
      const contentLength = res.get('content-length') || '0';

      // Capture authenticated user context if present
      const user = (req as any).user;
      const userId = user
        ? user.staffId || user.sub || user.telegramUserId || user.id
        : 'anonymous';

      // Sanitize request body if present (hide sensitive data)
      const sanitizedBody = this.sanitizeBody(req.body);
      const hasBody = req.body && Object.keys(req.body).length > 0;

      const logPayload = {
        context: 'HTTP',
        requestId,
        method,
        url: originalUrl,
        statusCode,
        durationMs: duration,
        ip,
        user: userId,
        contentLength,
        userAgent,
        ...(hasBody ? { body: sanitizedBody } : {}),
      };

      const message = `${method} ${originalUrl} ${statusCode} ${duration}ms - ${ip} [User:${userId}]`;

      if (statusCode >= 500) {
        winstonLogger.error(message, logPayload);
      } else if (statusCode >= 400) {
        winstonLogger.warn(message, logPayload);
      } else {
        winstonLogger.http(message, logPayload);
      }
    });

    next();
  }

  private sanitizeBody(body: any): any {
    if (!body || typeof body !== 'object') return body;
    const sensitiveKeys = [
      'password',
      'passwordHash',
      'token',
      'accessToken',
      'refreshToken',
      'initData',
      'secret',
    ];
    const sanitized: Record<string, any> = Array.isArray(body) ? [] : {};

    for (const key of Object.keys(body)) {
      if (
        sensitiveKeys.some((s) => key.toLowerCase().includes(s.toLowerCase()))
      ) {
        sanitized[key] = '***REDACTED***';
      } else if (typeof body[key] === 'object' && body[key] !== null) {
        sanitized[key] = this.sanitizeBody(body[key]);
      } else {
        sanitized[key] = body[key];
      }
    }
    return sanitized;
  }
}

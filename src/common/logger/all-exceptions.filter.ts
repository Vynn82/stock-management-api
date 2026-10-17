import {
  ExceptionFilter,
  Catch,
  ArgumentsHost,
  HttpException,
  HttpStatus,
} from '@nestjs/common';
import { Request, Response } from 'express';
import { winstonLogger } from './winston.config';

@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  catch(exception: unknown, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();

    const requestId =
      (request as any).requestId ||
      request.headers['x-request-id'] ||
      'unknown';

    let status = HttpStatus.INTERNAL_SERVER_ERROR;
    let message: any = 'Internal server error';
    let errorName = 'InternalServerError';

    if (exception instanceof HttpException) {
      status = exception.getStatus();
      const res = exception.getResponse();
      if (typeof res === 'string') {
        message = res;
      } else if (typeof res === 'object' && res !== null) {
        message = (res as any).message || res;
        errorName = (res as any).error || exception.name;
      }
    } else if (exception instanceof Error) {
      message = exception.message;
      errorName = exception.name;
    }

    const user = (request as any).user;
    const userId = user
      ? user.staffId || user.sub || user.telegramUserId || user.id
      : 'anonymous';

    const stack = exception instanceof Error ? exception.stack : undefined;

    // Log to Winston error transport
    winstonLogger.error(
      `Exception on ${request.method} ${request.originalUrl}: ${JSON.stringify(message)}`,
      {
        context: 'ExceptionFilter',
        requestId,
        method: request.method,
        url: request.originalUrl,
        statusCode: status,
        user: userId,
        error: errorName,
        stack,
      },
    );

    const errorResponse = {
      statusCode: status,
      error: errorName,
      message,
      timestamp: new Date().toISOString(),
      path: request.originalUrl,
      requestId,
    };

    response.status(status).json(errorResponse);
  }
}

import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { Request, Response } from 'express';
import { QueryFailedError } from 'typeorm';
import { REQUEST_ID_HEADER } from './request-id.middleware';

/** Stable, machine-readable error envelope returned for every failure. */
interface ErrorBody {
  error: {
    code: string;
    message: string;
    fields?: Record<string, string[]>;
  };
  requestId?: string;
}

const PG_UNIQUE_VIOLATION = '23505';

/**
 * One filter for the whole app, so EVERY error — validation, not-found,
 * unique-violation, or an unexpected crash — leaves through the same envelope.
 *
 * Crucially it never leaks stack traces, SQL or driver errors to the client:
 * the detail is logged server-side; the client gets a clean code + message.
 */
@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  private readonly logger = new Logger('ExceptionFilter');

  catch(exception: unknown, host: ArgumentsHost): void {
    const ctx = host.switchToHttp();
    const res = ctx.getResponse<Response>();
    const req = ctx.getRequest<Request>();
    const requestId = (req as Request & { requestId?: string }).requestId;

    const { status, body, logDetail } = this.normalize(exception);
    body.requestId = requestId;
    res.setHeader(REQUEST_ID_HEADER, requestId ?? '');

    if (status >= 500) {
      this.logger.error(`${req.method} ${req.url} -> ${status} ${body.error.code}: ${logDetail}`);
    } else {
      this.logger.warn(`${req.method} ${req.url} -> ${status} ${body.error.code}`);
    }

    res.status(status).json(body);
  }

  private normalize(exception: unknown): {
    status: number;
    body: ErrorBody;
    logDetail: string;
  } {
    // 1. A unique-violation that somehow escaped ON CONFLICT -> clean 409.
    if (exception instanceof QueryFailedError) {
      const code = (exception as QueryFailedError & { code?: string }).code;
      if (code === PG_UNIQUE_VIOLATION) {
        return {
          status: HttpStatus.CONFLICT,
          body: { error: { code: 'DUPLICATE_EVENT', message: 'Event already exists.' } },
          logDetail: exception.message,
        };
      }
      // Any other DB error is internal; never surface the SQL.
      return {
        status: HttpStatus.INTERNAL_SERVER_ERROR,
        body: { error: { code: 'INTERNAL_ERROR', message: 'Internal server error.' } },
        logDetail: exception.message,
      };
    }

    // 2. Nest HttpExceptions (validation 400, 404, etc.).
    // Use duck typing in addition to instanceof to handle module identity issues in tests.
    if (exception instanceof HttpException || this.isHttpExceptionLike(exception)) {
      const httpEx = exception as HttpException;
      const status = httpEx.getStatus();
      const response = httpEx.getResponse();
      return {
        status,
        body: this.fromHttpException(status, response),
        logDetail: typeof response === 'string' ? response : JSON.stringify(response),
      };
    }

    // 3. Anything else -> opaque 500.
    return {
      status: HttpStatus.INTERNAL_SERVER_ERROR,
      body: { error: { code: 'INTERNAL_ERROR', message: 'Internal server error.' } },
      logDetail:
        exception instanceof Error ? (exception.stack ?? exception.message) : String(exception),
    };
  }

  /** Duck-type check for HttpException to handle Jest module identity issues. */
  private isHttpExceptionLike(exception: unknown): exception is HttpException {
    return (
      exception !== null &&
      typeof exception === 'object' &&
      typeof (exception as HttpException).getStatus === 'function' &&
      typeof (exception as HttpException).getResponse === 'function'
    );
  }

  private fromHttpException(status: number, response: string | object): ErrorBody {
    const code = codeForStatus(status);

    if (typeof response === 'string') {
      return { error: { code, message: response } };
    }

    const r = response as { message?: string | string[]; error?: string };

    // ValidationPipe returns `message` as an array of field-level strings.
    if (Array.isArray(r.message)) {
      return {
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Request validation failed.',
          fields: groupValidationMessages(r.message),
        },
      };
    }

    return { error: { code, message: r.message ?? r.error ?? 'Error' } };
  }
}

function codeForStatus(status: number): string {
  switch (status) {
    case HttpStatus.BAD_REQUEST:
      return 'VALIDATION_ERROR';
    case HttpStatus.NOT_FOUND:
      return 'NOT_FOUND';
    case HttpStatus.CONFLICT:
      return 'CONFLICT';
    case HttpStatus.PAYLOAD_TOO_LARGE:
      return 'PAYLOAD_TOO_LARGE';
    default:
      return status >= 500 ? 'INTERNAL_ERROR' : 'ERROR';
  }
}

/** Best-effort grouping of "field message" strings into { field: [messages] }. */
function groupValidationMessages(messages: string[]): Record<string, string[]> {
  const fields: Record<string, string[]> = {};
  for (const msg of messages) {
    const field = msg.split(' ')[0] ?? '_';
    (fields[field] ??= []).push(msg);
  }
  return fields;
}

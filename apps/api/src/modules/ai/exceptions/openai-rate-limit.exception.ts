import { HttpException } from '@nestjs/common';
import { HttpStatus } from '@nestjs/common';

export class OpenAiRateLimitException extends HttpException {
  constructor(message = 'Demasiadas peticiones al asistente. Inténtalo de nuevo en unos segundos.', cause?: unknown) {
    super(message, HttpStatus.TOO_MANY_REQUESTS, { cause });
  }
}
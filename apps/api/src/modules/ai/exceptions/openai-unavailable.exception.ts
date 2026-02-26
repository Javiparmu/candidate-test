import { ServiceUnavailableException } from '@nestjs/common';

export class OpenAiUnavailableException extends ServiceUnavailableException {
  constructor(message = 'OpenAI no está disponible. Por favor, inténtalo de nuevo más tarde.', cause?: unknown) {
    super(message, { cause });
  }
}

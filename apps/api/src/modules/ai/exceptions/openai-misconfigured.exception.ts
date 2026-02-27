import { InternalServerErrorException } from '@nestjs/common';

export class OpenAiMisconfiguredException extends InternalServerErrorException {
  constructor(message = 'Configuración de OpenAI inválida.', cause?: unknown) {
    super(message, { cause });
  }
}
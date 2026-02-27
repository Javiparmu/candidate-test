import { BadGatewayException } from '@nestjs/common';

export class OpenAiInvalidResponseException extends BadGatewayException {
  constructor(message = 'OpenAI no ha devuelto una respuesta válida.', cause?: unknown) {
    super(message, { cause });
  }
}

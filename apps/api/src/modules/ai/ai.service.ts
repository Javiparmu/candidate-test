import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { OpenAiUnavailableException } from './exceptions/openai-unavailable.exception';
import OpenAI from 'openai';
import { ResponseInput } from 'openai/resources/responses/responses';

interface MessageHistory {
  role: 'user' | 'assistant' | 'system';
  content: string;
}

interface AiResponse {
  content: string;
  tokensUsed?: number;
  model?: string;
}

@Injectable()
export class AiService {
  private static readonly RETRY_MAX_ATTEMPTS = 3;
  private static readonly RETRY_BASE_DELAY_MS = 300;

  private readonly logger = new Logger(AiService.name);
  private readonly openai: OpenAI;
  private readonly chatModel: string;

  /**
   * System prompt base para el asistente de estudiantes
   * El candidato puede modificar o extender este prompt
   */
  private readonly baseSystemPrompt = `Eres un asistente educativo amigable y servicial para estudiantes de una plataforma de cursos online.

Tu objetivo es:
- Ayudar a los estudiantes con dudas sobre el contenido de sus cursos
- Motivar y dar apoyo emocional cuando sea necesario
- Sugerir recursos y técnicas de estudio
- Responder de forma clara, concisa y amigable

Reglas:
- No des respuestas a exámenes directamente, guía al estudiante para que llegue a la respuesta
- Si no sabes algo, admítelo y sugiere buscar ayuda adicional
- Mantén un tono positivo y motivador
- Usa ejemplos prácticos cuando sea posible`;

  constructor(private readonly configService: ConfigService) {
    const apiKey = this.configService.get<string>('OPENAI_API_KEY');
    this.chatModel = this.configService.get<string>('OPENAI_CHAT_MODEL') || 'gpt-4';

    if (apiKey) {
      this.openai = new OpenAI({ apiKey });
    } else {
      this.logger.warn('OPENAI_API_KEY not configured. Placeholder responses will be used.');
    }
  }

  async generateResponse(
    userMessage: string,
    history: MessageHistory[] = [],
  ): Promise<AiResponse> {
    this.logger.debug(`Generando respuesta para: "${userMessage.substring(0, 50)}..."`);

    return this.response(userMessage, history, this.baseSystemPrompt);
  }

  async generateResponseWithRAG(
    userMessage: string,
    history: MessageHistory[] = [],
    relevantContext: string[] = []
  ): Promise<AiResponse> {
    const contextBlock = relevantContext.length > 0
      ? `\n\nINFORMACIÓN RELEVANTE:\n${relevantContext.join('\n\n')}\n\nUsa esta información para responder.`
      : '';
    return this.response(
      userMessage,
      history,
      this.baseSystemPrompt + contextBlock
    );
  }

  private async response(
    userMessage: string,
    history: MessageHistory[],
    systemPrompt: string
  ): Promise<AiResponse> {
    if (!this.isConfigured()) {
      this.logger.warn('OPENAI_API_KEY not configured. Placeholder responses will be used.');
      return this.generatePlaceholderResponse(userMessage);
    }

    const messages: ResponseInput = [
      { role: 'system', content: systemPrompt },
      ...history,
      { role: 'user', content: userMessage.trim() },
    ];

    let lastError: unknown;

    for (let attempt = 1; attempt <= AiService.RETRY_MAX_ATTEMPTS; attempt++) {
      try {
        const response = await this.openai.responses.create({
          model: this.chatModel,
          input: messages,
        });

        const content = response.output_text?.trim();

        if (!content) {
          throw new Error('Empty response from OpenAI');
        }

        return {
          content,
          tokensUsed: response.usage?.total_tokens,
          model: response.model,
        };
      } catch (error) {
        lastError = error;

        if (!this.shouldRetry(error) || attempt === AiService.RETRY_MAX_ATTEMPTS) {
          break;
        }

        const delayMs = AiService.RETRY_BASE_DELAY_MS * 2 ** (attempt - 1);
        this.logger.warn(
          `Transient OpenAI error (attempt ${attempt}/${AiService.RETRY_MAX_ATTEMPTS}). Retrying in ${delayMs}ms`
        );
        await new Promise((resolve) => setTimeout(resolve, delayMs));
      }
    }

    this.logger.error('Failed to generate response with OpenAI', lastError as Error);
    throw new OpenAiUnavailableException(
      'OpenAI no está disponible. Por favor, inténtalo de nuevo más tarde.',
      lastError
    );
  }

  async *generateStreamResponse(
    userMessage: string,
    history: MessageHistory[] = []
  ): AsyncGenerator<string> {
    yield* this.stream(userMessage, history, this.baseSystemPrompt);
  }

  async *generateStreamResponseWithRAG(
    userMessage: string,
    history: MessageHistory[] = [],
    relevantContext: string[] = []
  ): AsyncGenerator<string> {
    const contextBlock = relevantContext.length > 0
      ? `\n\nINFORMACIÓN RELEVANTE:\n${relevantContext.join('\n\n')}\n\nUsa esta información para responder.`
      : '';
    yield* this.stream(
      userMessage,
      history,
      this.baseSystemPrompt + contextBlock
    );
  }

  private async *stream(
    userMessage: string,
    history: MessageHistory[],
    systemPrompt: string
  ): AsyncGenerator<string> {
    if (!this.openai) {
      const placeholder = this.generatePlaceholderResponse(userMessage);
      const words = placeholder.content.split(' ');
      for (const word of words) {
        yield word + ' ';
        await new Promise((resolve) => setTimeout(resolve, 50));
      }
      return;
    }

    const openai = this.openai;
    const messages: ResponseInput = [
      { role: 'system', content: systemPrompt },
      ...history,
      { role: 'user', content: userMessage.trim() },
    ];

    try {
      const stream = await openai.responses.create({
        model: this.chatModel,
        input: messages,
        stream: true,
      });

      for await (const event of stream) {
        if (
          event.type === 'response.output_text.delta' &&
          'delta' in event
        ) {
          yield event.delta as string;
        }
      }
    } catch (error) {
      this.logger.error('OpenAI stream failed', error as Error);
      throw new OpenAiUnavailableException(
        'Error al generar la respuesta en streaming. Inténtalo de nuevo.',
        error
      );
    }
  }

  buildContextualSystemPrompt(studentContext: {
    name: string;
    currentCourse?: string;
    progress?: number;
  }): string {
    let prompt = this.baseSystemPrompt;
    prompt += `\n\nContexto del estudiante:`;
    prompt += `\n- Nombre: ${studentContext.name}`;
    if (studentContext.currentCourse) {
      prompt += `\n- Curso actual: ${studentContext.currentCourse}`;
    }
    if (studentContext.progress !== undefined) {
      prompt += `\n- Progreso: ${studentContext.progress}%`;
    }
    return prompt;
  }

  private generatePlaceholderResponse(userMessage: string): AiResponse {
    const responses = [
      '¡Hola! Soy tu asistente de estudios. Veo que tienes una pregunta interesante. Para ayudarte mejor, ¿podrías darme más detalles sobre el tema específico del curso en el que necesitas ayuda?',
      'Entiendo tu duda. Este es un tema importante que muchos estudiantes encuentran desafiante. Te sugiero que revisemos los conceptos paso a paso. ¿Por dónde te gustaría empezar?',
      '¡Excelente pregunta! Esto demuestra que estás pensando críticamente sobre el material. Déjame darte una explicación que te ayude a entender mejor el concepto.',
      'Gracias por compartir tu pregunta. Para darte la mejor ayuda posible, necesito que OpenAI esté configurado. Por ahora, te recomiendo revisar el material del curso y volver con preguntas específicas.',
    ];

    const randomResponse = responses[Math.floor(Math.random() * responses.length)];

    return {
      content: `[RESPUESTA PLACEHOLDER - Implementar OpenAI]\n\n${randomResponse}`,
      tokensUsed: 0,
      model: 'placeholder',
    };
  }

  /**
   * Verifica si OpenAI está configurado
   */
  isConfigured(): boolean {
    return !!this.configService.get<string>('OPENAI_API_KEY');
  }

  private shouldRetry(error: unknown): boolean {
    if (!error || typeof error !== 'object') {
      return false;
    }

    const maybeStatus = (
      error as {
        status?: number;
      }
    ).status;

    return maybeStatus === 429 || (typeof maybeStatus === 'number' && maybeStatus >= 500);
  }
}

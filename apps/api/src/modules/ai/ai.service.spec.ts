import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { AiService } from './ai.service';

const mockResponsesCreate = jest.fn();

jest.mock('openai', () => {
  return {
    __esModule: true,
    default: class {
      responses = {
        create: mockResponsesCreate,
      };
    },
  };
});

describe('AiService', () => {
  const mockConfigService = {
    get: jest.fn(),
  };

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('without OpenAI configured', () => {
    let service: AiService;

    beforeEach(async () => {
      mockConfigService.get.mockImplementation((key: string) => {
        if (key === 'OPENAI_API_KEY') return undefined;
        return null;
      });

      const module: TestingModule = await Test.createTestingModule({
        providers: [AiService, { provide: ConfigService, useValue: mockConfigService }],
      }).compile();

      service = module.get<AiService>(AiService);
    });

    describe('isConfigured', () => {
      it('should return false when API key is not set', () => {
        mockConfigService.get.mockImplementation((key: string) => {
          if (key === 'OPENAI_API_KEY') return undefined;
          return null;
        });

        expect(service.isConfigured()).toBe(false);
      });
    });

    describe('generateResponse', () => {
      it('should return placeholder response when OpenAI not configured', async () => {
        const result = await service.generateResponse('Hello');

        expect(result).toEqual(
          expect.objectContaining({
            content: expect.any(String),
            model: 'placeholder',
          })
        );
        expect(result.content).toContain('PLACEHOLDER');
      });
    });
  });

  describe('with OpenAI configured', () => {
    let service: AiService;

    beforeEach(async () => {
      mockResponsesCreate.mockReset();

      mockConfigService.get.mockImplementation((key: string) => {
        if (key === 'OPENAI_API_KEY') return 'sk-test-key';
        if (key === 'OPENAI_CHAT_MODEL') return 'gpt-4';
        return null;
      });

      const module: TestingModule = await Test.createTestingModule({
        providers: [AiService, { provide: ConfigService, useValue: mockConfigService }],
      }).compile();

      service = module.get<AiService>(AiService);
    });

    describe('isConfigured', () => {
      it('should return true when API key is set', () => {
        mockConfigService.get.mockImplementation((key: string) => {
          if (key === 'OPENAI_API_KEY') return 'sk-test-key';
          if (key === 'OPENAI_CHAT_MODEL') return 'gpt-4';
          return null;
        });

        expect(service.isConfigured()).toBe(true);
      });
    });

    describe('generateResponse', () => {
      it('should call OpenAI API with correct parameters', async () => {
        mockResponsesCreate.mockResolvedValue({
          output_text: 'Test response',
          usage: { total_tokens: 50 },
          model: 'gpt-4',
        });

        await service.generateResponse('Hello');

        expect(mockResponsesCreate).toHaveBeenCalledTimes(1);
        expect(mockResponsesCreate).toHaveBeenCalledWith(
          expect.objectContaining({
            model: 'gpt-4',
          })
        );
      });

      it('should include system prompt in messages', async () => {
        mockResponsesCreate.mockResolvedValue({
          output_text: 'Test response',
          usage: { total_tokens: 50 },
          model: 'gpt-4',
        });

        await service.generateResponse('Hello');

        const callArgs = mockResponsesCreate.mock.calls[0]?.[0];
        expect(callArgs).toBeTruthy();
        expect(Array.isArray(callArgs.input)).toBe(true);

        const systemMsgs = (callArgs.input as any[]).filter((m) => m?.role === 'system');
        expect(systemMsgs.length).toBeGreaterThan(0);
        expect(systemMsgs.some((m) => typeof m.content === 'string' && m.content.includes('asistente educativo'))).toBe(
          true
        );
      });

      it('should include conversation history', async () => {
        mockResponsesCreate.mockResolvedValue({
          output_text: 'Test response',
          usage: { total_tokens: 50 },
          model: 'gpt-4',
        });

        const history = [
          { role: 'user' as const, content: 'Previous question' },
          { role: 'assistant' as const, content: 'Previous answer' },
        ];

        await service.generateResponse('New question', history);

        const callArgs = mockResponsesCreate.mock.calls[0]?.[0];
        expect(callArgs).toBeTruthy();

        const input = callArgs.input as any[];
        expect(input).toEqual(
          expect.arrayContaining([
            expect.objectContaining({ role: 'user', content: 'Previous question' }),
            expect.objectContaining({ role: 'assistant', content: 'Previous answer' }),
          ])
        );
        expect(input.some((m) => m?.role === 'user' && m?.content === 'New question')).toBe(true);
      });

      it('should handle OpenAI API errors', async () => {
        mockResponsesCreate.mockRejectedValue(new Error('API Error'));

        await expect(service.generateResponse('Hello')).rejects.toThrow('OpenAI no está disponible');
      });

      it('should return token usage information', async () => {
        mockResponsesCreate.mockResolvedValue({
          output_text: 'Test response',
          usage: { total_tokens: 150 },
          model: 'gpt-4',
        });

        const result = await service.generateResponse('Hello');

        expect(result.tokensUsed).toBe(150);
        expect(result.model).toBe('gpt-4');
      });
    });
  });

  describe('generateStreamResponse', () => {
    let service: AiService;

    beforeEach(async () => {
      mockConfigService.get.mockImplementation((key: string) => {
        if (key === 'OPENAI_API_KEY') return undefined;
        return null;
      });

      const module = await Test.createTestingModule({
        providers: [AiService, { provide: ConfigService, useValue: mockConfigService }],
      }).compile();

      service = module.get<AiService>(AiService);
    });

    it('should yield tokens one by one', async () => {
      const tokens: string[] = [];
      for await (const token of service.generateStreamResponse('Hello')) {
        tokens.push(token);
      }
      expect(tokens.length).toBeGreaterThan(0);
      expect(tokens.every((t) => typeof t === 'string')).toBe(true);
    });

    it('should handle stream interruption', async () => {
      let count = 0;
      for await (const _token of service.generateStreamResponse('Hello')) {
        count++;
        if (count === 1) break;
      }
      expect(count).toBe(1);
    });

    it('should complete stream successfully', async () => {
      const tokens: string[] = [];
      for await (const token of service.generateStreamResponse('Hello')) {
        tokens.push(token);
      }
      const fullText = tokens.join('');
      expect(fullText.length).toBeGreaterThan(0);
      expect(fullText).toContain('PLACEHOLDER');
    });
  });

  describe('buildContextualSystemPrompt', () => {
    let service: AiService;

    beforeEach(async () => {
      mockConfigService.get.mockReturnValue(undefined);

      const module = await Test.createTestingModule({
        providers: [AiService, { provide: ConfigService, useValue: mockConfigService }],
      }).compile();

      service = module.get<AiService>(AiService);
    });

    it('should include student name in prompt', () => {
      const prompt = service.buildContextualSystemPrompt({ name: 'María' });
      expect(prompt).toContain('María');
    });

    it('should include current course if provided', () => {
      const prompt = service.buildContextualSystemPrompt({
        name: 'María',
        currentCourse: 'React Hooks',
      });
      expect(prompt).toContain('React Hooks');
    });

    it('should include progress percentage', () => {
      const prompt = service.buildContextualSystemPrompt({
        name: 'María',
        progress: 75,
      });
      expect(prompt).toContain('75');
    });

    it('should maintain base prompt content', () => {
      const prompt = service.buildContextualSystemPrompt({ name: 'María' });
      expect(prompt).toContain('asistente educativo');
    });
  });
});
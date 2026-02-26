import { Test, TestingModule } from '@nestjs/testing';
import { getModelToken } from '@nestjs/mongoose';
import { Types } from 'mongoose';
import { ChatService } from './chat.service';
import { AiService } from '../ai/ai.service';
import { KnowledgeService } from '../knowledge/knowledge.service';
import { ChatMessage } from './schemas/chat-message.schema';
import { Conversation } from './schemas/conversation.schema';

describe('ChatService', () => {
  let service: ChatService;

  const mockChatMessageModel = {
    create: jest.fn(),
    find: jest.fn(),
    findById: jest.fn(),
    countDocuments: jest.fn(),
    deleteMany: jest.fn(),
  };

  const mockConversationModel = {
    create: jest.fn(),
    find: jest.fn(),
    findOne: jest.fn(),
    findById: jest.fn(),
    findByIdAndUpdate: jest.fn(),
    findByIdAndDelete: jest.fn(),
    updateMany: jest.fn(),
  };

  const mockAiService = {
    generateResponse: jest.fn(),
    generateResponseWithRAG: jest.fn(),
    generateStreamResponseWithRAG: jest.fn(),
  };

  const mockKnowledgeService = {
    searchSimilar: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ChatService,
        {
          provide: getModelToken(ChatMessage.name),
          useValue: mockChatMessageModel,
        },
        {
          provide: getModelToken(Conversation.name),
          useValue: mockConversationModel,
        },
        {
          provide: AiService,
          useValue: mockAiService,
        },
        {
          provide: KnowledgeService,
          useValue: mockKnowledgeService,
        },
      ],
    }).compile();

    service = module.get<ChatService>(ChatService);
  });

  function mockFindForHistory(messages: any[] = []) {
    return mockChatMessageModel.find.mockReturnValue({
      sort: jest.fn().mockReturnThis(),
      limit: jest.fn().mockReturnThis(),
      lean: jest.fn().mockResolvedValue(messages),
    });
  }

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('sendMessage', () => {
    it('should create user message and get AI response', async () => {
      const convId = new Types.ObjectId();
      const conversation = { _id: convId, studentId: new Types.ObjectId(), title: 'Test', isActive: true };
      const userMsg = { _id: new Types.ObjectId(), role: 'user', content: 'Hello', conversationId: convId };
      const assistantMsg = {
        _id: new Types.ObjectId(),
        role: 'assistant',
        content: 'Hi there',
        conversationId: convId,
      };

      mockFindForHistory([]);
      mockConversationModel.findById.mockResolvedValue(conversation);
      mockChatMessageModel.create
        .mockResolvedValueOnce(userMsg)
        .mockResolvedValueOnce(assistantMsg);
      mockKnowledgeService.searchSimilar.mockResolvedValue([]);
      mockAiService.generateResponseWithRAG.mockResolvedValue({
        content: 'Hi there',
        tokensUsed: 10,
        model: 'gpt-4',
      });
      mockConversationModel.findByIdAndUpdate.mockResolvedValue({});

      const result = await service.sendMessage({
        studentId: convId.toString(),
        message: 'Hello',
        conversationId: convId.toString(),
      });

      expect(mockChatMessageModel.create).toHaveBeenCalledTimes(2);
      expect(mockChatMessageModel.create).toHaveBeenNthCalledWith(1, {
        conversationId: convId,
        role: 'user',
        content: 'Hello',
      });
      expect(mockAiService.generateResponseWithRAG).toHaveBeenCalledWith(
        'Hello',
        expect.any(Array),
        []
      );
      expect(result.conversationId).toEqual(convId);
      expect(result.userMessage).toEqual(userMsg);
      expect(result.assistantMessage).toEqual(assistantMsg);
    });

    it('should create new conversation if none exists', async () => {
      const studentId = new Types.ObjectId().toString();
      const newConv = {
        _id: new Types.ObjectId(),
        studentId: new Types.ObjectId(studentId),
        title: 'Nueva conversación',
        isActive: true,
      };
      const userMsg = { _id: new Types.ObjectId(), role: 'user', content: 'Hi', conversationId: newConv._id };
      const assistantMsg = { _id: new Types.ObjectId(), role: 'assistant', content: 'Hello', conversationId: newConv._id };

      mockFindForHistory([]);
      mockConversationModel.findById.mockResolvedValue(null);
      mockConversationModel.create.mockResolvedValue(newConv);
      mockChatMessageModel.create
        .mockResolvedValueOnce(userMsg)
        .mockResolvedValueOnce(assistantMsg);
      mockKnowledgeService.searchSimilar.mockResolvedValue([]);
      mockAiService.generateResponseWithRAG.mockResolvedValue({ content: 'Hello', tokensUsed: 5, model: 'gpt-4' });
      mockConversationModel.findByIdAndUpdate.mockResolvedValue({});

      await service.sendMessage({
        studentId,
        message: 'Hi',
        conversationId: undefined as any,
      });

      expect(mockConversationModel.create).toHaveBeenCalledWith(
        expect.objectContaining({
          studentId: new Types.ObjectId(studentId),
          title: 'Nueva conversación',
          isActive: true,
        })
      );
      expect(mockChatMessageModel.create).toHaveBeenCalledTimes(2);
    });

    it('should use existing conversation if provided', async () => {
      const convId = new Types.ObjectId();
      const conversation = { _id: convId, studentId: new Types.ObjectId(), title: 'Existing', isActive: true };
      const userMsg = { _id: new Types.ObjectId(), role: 'user', content: 'Hi', conversationId: convId };
      const assistantMsg = { _id: new Types.ObjectId(), role: 'assistant', content: 'Hey', conversationId: convId };

      mockFindForHistory([]);
      mockConversationModel.findById.mockResolvedValue(conversation);
      mockChatMessageModel.create.mockResolvedValueOnce(userMsg).mockResolvedValueOnce(assistantMsg);
      mockKnowledgeService.searchSimilar.mockResolvedValue([]);
      mockAiService.generateResponseWithRAG.mockResolvedValue({ content: 'Hey', tokensUsed: 5, model: 'gpt-4' });
      mockConversationModel.findByIdAndUpdate.mockResolvedValue({});

      await service.sendMessage({
        studentId: conversation.studentId.toString(),
        message: 'Hi',
        conversationId: convId.toString(),
      });

      expect(mockConversationModel.findById).toHaveBeenCalledWith(convId.toString());
      expect(mockConversationModel.create).not.toHaveBeenCalled();
    });

    it('should handle AI service errors gracefully', async () => {
      const convId = new Types.ObjectId();
      const conversation = { _id: convId, studentId: new Types.ObjectId(), title: 'Test', isActive: true };
      const userMsg = { _id: new Types.ObjectId(), role: 'user', content: 'Hi', conversationId: convId };

      mockFindForHistory([]);
      mockConversationModel.findById.mockResolvedValue(conversation);
      mockChatMessageModel.create.mockResolvedValueOnce(userMsg);
      mockKnowledgeService.searchSimilar.mockResolvedValue([]);
      mockAiService.generateResponseWithRAG.mockRejectedValue(new Error('API Error'));

      await expect(
        service.sendMessage({
          studentId: convId.toString(),
          message: 'Hi',
          conversationId: convId.toString(),
        })
      ).rejects.toThrow();
    });
  });

  describe('startNewConversation', () => {
    it('should create a new conversation', async () => {
      const studentId = new Types.ObjectId().toString();
      const newConv = {
        _id: new Types.ObjectId(),
        studentId: new Types.ObjectId(studentId),
        title: 'Nueva conversación',
        isActive: true,
      };

      mockConversationModel.create.mockResolvedValue(newConv);
      mockConversationModel.updateMany.mockResolvedValue({ modifiedCount: 0 });

      const result = await service.startNewConversation(studentId);

      expect(mockConversationModel.create).toHaveBeenCalledWith(
        expect.objectContaining({
          studentId: new Types.ObjectId(studentId),
          title: 'Nueva conversación',
          isActive: true,
        })
      );
      expect(result).toEqual(newConv);
    });

    it('should mark previous conversations as inactive', async () => {
      const studentId = new Types.ObjectId().toString();
      const newConv = { _id: new Types.ObjectId(), studentId: new Types.ObjectId(studentId), title: 'New', isActive: true };

      mockConversationModel.create.mockResolvedValue(newConv);
      mockConversationModel.updateMany.mockResolvedValue({ modifiedCount: 2 });

      await service.startNewConversation(studentId);

      expect(mockConversationModel.updateMany).toHaveBeenCalledWith(
        {
          studentId: new Types.ObjectId(studentId),
          _id: { $ne: newConv._id },
        },
        { isActive: false }
      );
    });

    it('should set cache with initialContext for new conversation', async () => {
      const studentId = new Types.ObjectId().toString();
      const newConv = { _id: new Types.ObjectId(), studentId: new Types.ObjectId(studentId), title: 'New', isActive: true };

      mockConversationModel.create.mockResolvedValue(newConv);
      mockConversationModel.updateMany.mockResolvedValue({});
      mockConversationModel.findById.mockResolvedValue(newConv);
      mockChatMessageModel.create
        .mockResolvedValueOnce({ _id: new Types.ObjectId(), role: 'user', content: 'First' })
        .mockResolvedValueOnce({ _id: new Types.ObjectId(), role: 'assistant', content: 'Reply' });
      mockKnowledgeService.searchSimilar.mockResolvedValue([]);
      mockAiService.generateResponseWithRAG.mockImplementation((_msg, history) => {
        const hasInitial = history.some((m: any) => m.role === 'system' && m.content === 'Initial context');
        return Promise.resolve({
          content: hasInitial ? 'Reply' : 'No context',
          tokensUsed: 5,
          model: 'gpt-4',
        });
      });
      mockConversationModel.findByIdAndUpdate.mockResolvedValue({});

      const conv = await service.startNewConversation(studentId, 'Initial context');
      expect(conv._id).toEqual(newConv._id);

      await service.sendMessage({
        studentId,
        message: 'First',
        conversationId: conv._id.toString(),
      });

      expect(mockAiService.generateResponseWithRAG).toHaveBeenCalledWith(
        'First',
        expect.arrayContaining([expect.objectContaining({ role: 'system', content: 'Initial context' })]),
        expect.any(Array)
      );
    });

    it('should not affect history of previous conversations', async () => {
      const studentId = new Types.ObjectId().toString();
      const firstConv = { _id: new Types.ObjectId(), studentId: new Types.ObjectId(studentId), isActive: true };
      const secondConv = { _id: new Types.ObjectId(), studentId: new Types.ObjectId(studentId), isActive: true };

      mockConversationModel.create.mockResolvedValueOnce(firstConv).mockResolvedValueOnce(secondConv);
      mockConversationModel.updateMany.mockResolvedValue({});

      await service.startNewConversation(studentId);
      await service.startNewConversation(studentId);

      expect(mockConversationModel.updateMany).toHaveBeenLastCalledWith(
        { studentId: new Types.ObjectId(studentId), _id: { $ne: secondConv._id } },
        { isActive: false }
      );
    });
  });

  describe('getHistory', () => {
    it('should return paginated chat history', async () => {
      const studentId = new Types.ObjectId().toString();
      const convId = new Types.ObjectId();
      const conversation = { _id: convId, studentId: new Types.ObjectId(studentId), title: 'Conv' };
      const messages = [
        { _id: new Types.ObjectId(), role: 'user', content: 'A', createdAt: new Date() },
        { _id: new Types.ObjectId(), role: 'assistant', content: 'B', createdAt: new Date() },
      ];

      mockConversationModel.findOne.mockReturnValue({
        lean: jest.fn().mockResolvedValue(conversation),
      });
      mockChatMessageModel.find.mockReturnValue({
        sort: jest.fn().mockReturnThis(),
        skip: jest.fn().mockReturnThis(),
        limit: jest.fn().mockReturnThis(),
        lean: jest.fn().mockResolvedValue(messages),
      });
      mockChatMessageModel.countDocuments.mockResolvedValue(2);

      const result = await service.getHistory(studentId, convId.toString(), 2, 10);

      expect(mockConversationModel.findOne).toHaveBeenCalledWith({
        _id: convId,
        studentId: new Types.ObjectId(studentId),
      });
      expect(result).toEqual({
        conversation,
        messages,
        pagination: { page: 2, limit: 10, total: 2, totalPages: 1 },
      });
    });

    it('should filter by conversationId when provided', async () => {
      const studentId = new Types.ObjectId().toString();
      const convId = new Types.ObjectId();
      const conversation = { _id: convId, studentId: new Types.ObjectId(studentId) };

      mockConversationModel.findOne.mockReturnValue({
        lean: jest.fn().mockResolvedValue(conversation),
      });
      mockChatMessageModel.find.mockReturnValue({
        sort: jest.fn().mockReturnThis(),
        skip: jest.fn().mockReturnThis(),
        limit: jest.fn().mockReturnThis(),
        lean: jest.fn().mockResolvedValue([]),
      });
      mockChatMessageModel.countDocuments.mockResolvedValue(0);

      await service.getHistory(studentId, convId.toString());

      expect(mockConversationModel.findOne).toHaveBeenCalledWith({
        _id: convId,
        studentId: new Types.ObjectId(studentId),
      });
    });

    it('should return messages in chronological order', async () => {
      const studentId = new Types.ObjectId().toString();
      const convId = new Types.ObjectId();
      const conversation = { _id: convId, studentId: new Types.ObjectId(studentId) };

      const chain = {
        sort: jest.fn().mockReturnThis(),
        skip: jest.fn().mockReturnThis(),
        limit: jest.fn().mockReturnThis(),
        lean: jest.fn().mockResolvedValue([]),
      };
      mockConversationModel.findOne.mockReturnValue({
        lean: jest.fn().mockResolvedValue(conversation),
      });
      mockChatMessageModel.find.mockReturnValue(chain);
      mockChatMessageModel.countDocuments.mockResolvedValue(0);

      await service.getHistory(studentId, convId.toString(), 1, 20);

      expect(chain.sort).toHaveBeenCalledWith({ createdAt: 1 });
    });
  });

  describe('deleteHistory', () => {
    it('should delete all messages from conversation', async () => {
      const studentId = new Types.ObjectId().toString();
      const convId = new Types.ObjectId();
      const conversation = { _id: convId, studentId: new Types.ObjectId(studentId) };

      mockConversationModel.findOne.mockResolvedValue(conversation);
      mockChatMessageModel.deleteMany.mockResolvedValue({ deletedCount: 5 });
      mockConversationModel.findByIdAndDelete.mockResolvedValue(conversation);

      const result = await service.deleteHistory(studentId, convId.toString());

      expect(mockChatMessageModel.deleteMany).toHaveBeenCalledWith({ conversationId: convId });
      expect(mockConversationModel.findByIdAndDelete).toHaveBeenCalledWith(convId);
      expect(result).toEqual({ deletedMessages: 5 });
    });

    it('should clear cache for deleted conversation', async () => {
      const studentId = new Types.ObjectId().toString();
      const convId = new Types.ObjectId();
      const conversation = { _id: convId, studentId: new Types.ObjectId(studentId) };

      mockConversationModel.findOne.mockResolvedValue(conversation);
      mockChatMessageModel.deleteMany.mockResolvedValue({ deletedCount: 0 });
      mockConversationModel.findByIdAndDelete.mockResolvedValue(conversation);

      await service.deleteHistory(studentId, convId.toString());

      expect(mockConversationModel.findByIdAndDelete).toHaveBeenCalled();
    });

    it('should return null if conversation not found', async () => {
      mockConversationModel.findOne.mockResolvedValue(null);

      const result = await service.deleteHistory(
        new Types.ObjectId().toString(),
        new Types.ObjectId().toString()
      );

      expect(result).toBeNull();
      expect(mockChatMessageModel.deleteMany).not.toHaveBeenCalled();
    });
  });

  describe('streamResponse', () => {
    it('should stream AI response tokens', async () => {
      const studentId = new Types.ObjectId().toString();
      const convId = new Types.ObjectId();
      const conversation = { _id: convId, studentId: new Types.ObjectId(studentId), isActive: true };
      const userMsg = { _id: new Types.ObjectId(), role: 'user', content: 'Hi', conversationId: convId };
      const assistantMsg = { _id: new Types.ObjectId(), role: 'assistant', content: 'abc', conversationId: convId };

      mockFindForHistory([]);
      mockConversationModel.findById.mockResolvedValue(null);
      mockConversationModel.create.mockResolvedValue(conversation);
      mockChatMessageModel.create.mockResolvedValueOnce(userMsg).mockResolvedValueOnce(assistantMsg);
      mockKnowledgeService.searchSimilar.mockResolvedValue([]);

      async function* tokenGen() {
        yield 'a';
        yield 'b';
        yield 'c';
      }
      mockAiService.generateStreamResponseWithRAG.mockReturnValue(tokenGen());
      mockConversationModel.findByIdAndUpdate.mockResolvedValue({});

      const events: Record<string, unknown>[] = [];
      for await (const event of service.streamResponse({ studentId, message: 'Hi' })) {
        events.push(event);
      }

      expect(events.some((e) => e.conversationId)).toBe(true);
      expect(events.filter((e) => (e as any).token)).toHaveLength(3);
      expect(events.some((e) => (e as any).done === true && (e as any).messageId)).toBe(true);
    });

    it('should handle streaming errors', async () => {
      mockFindForHistory([]);
      mockConversationModel.findById.mockResolvedValue(null);
      mockConversationModel.create.mockResolvedValue({
        _id: new Types.ObjectId(),
        studentId: new Types.ObjectId(),
        isActive: true,
      });
      mockChatMessageModel.create.mockResolvedValue({});
      mockKnowledgeService.searchSimilar.mockResolvedValue([]);
      mockAiService.generateStreamResponseWithRAG.mockImplementation(async function* () {
        yield 'x';
        throw new Error('Stream failed');
      });

      const gen = service.streamResponse({
        studentId: new Types.ObjectId().toString(),
        message: 'Hi',
      });

      await expect(gen.next()).resolves.toMatchObject({ value: expect.objectContaining({ conversationId: expect.any(String) }) });
      await expect(gen.next()).resolves.toMatchObject({ value: { token: 'x' } });
      await expect(gen.next()).rejects.toThrow('Stream failed');
    });

    it('should complete stream correctly', async () => {
      const studentId = new Types.ObjectId().toString();
      const convId = new Types.ObjectId();
      const conversation = { _id: convId, studentId: new Types.ObjectId(studentId), isActive: true };

      mockFindForHistory([]);
      mockConversationModel.findById.mockResolvedValue(null);
      mockConversationModel.create.mockResolvedValue(conversation);
      mockChatMessageModel.create
        .mockResolvedValueOnce({ _id: new Types.ObjectId(), role: 'user' })
        .mockResolvedValueOnce({ _id: new Types.ObjectId(), role: 'assistant', content: 'Done' });
      mockKnowledgeService.searchSimilar.mockResolvedValue([]);

      async function* tokenGen() {
        yield 'D';
        yield 'one';
      }
      mockAiService.generateStreamResponseWithRAG.mockReturnValue(tokenGen());
      mockConversationModel.findByIdAndUpdate.mockResolvedValue({});

      const events: Record<string, unknown>[] = [];
      for await (const event of service.streamResponse({ studentId, message: 'Hi' })) {
        events.push(event);
      }

      const last = events[events.length - 1];
      expect(last).toMatchObject({ done: true });
      expect((last as any).messageId).toBeDefined();
    });
  });
});
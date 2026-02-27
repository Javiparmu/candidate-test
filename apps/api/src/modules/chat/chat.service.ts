import {
  HttpException,
  Injectable,
  InternalServerErrorException,
  Logger,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { ChatMessage, ChatMessageDocument } from './schemas/chat-message.schema';
import { Conversation, ConversationDocument } from './schemas/conversation.schema';
import { AiService } from '../ai/ai.service';
import { KnowledgeService } from '../knowledge/knowledge.service';
import { SendMessageDto } from './dto/send-message.dto';

interface MessageHistory {
  role: 'user' | 'assistant' | 'system';
  content: string;
}

@Injectable()
export class ChatService {
  private readonly logger = new Logger(ChatService.name);

  // Cache de historial de conversaciones en memoria para optimizar
  private conversationCache: Map<string, MessageHistory[]> = new Map();

  constructor(
    @InjectModel(ChatMessage.name) private chatMessageModel: Model<ChatMessageDocument>,
    @InjectModel(Conversation.name) private conversationModel: Model<ConversationDocument>,
    private readonly aiService: AiService,
    private readonly knowledgeService: KnowledgeService
  ) {}

  async sendMessage(dto: SendMessageDto) {
    const { studentId, message, conversationId } = dto;

    try {
      let conversation = await this.conversationModel.findById(conversationId);

      if (!conversation) {
        conversation = await this.createConversation(studentId);
      }

      const userMessage = await this.chatMessageModel.create({
        conversationId: conversation._id,
        role: 'user',
        content: message,
      });

      let relevantContext: string[] = [];
      try {
        const searchResults = await this.knowledgeService.searchSimilar(message, {
          limit: 3,
          minScore: 0.5,
        });
        relevantContext = searchResults.map((r) => r.content);
      } catch (error) {
        this.logger.warn('Error searching RAG context', error);
      }

      const history = await this.getConversationHistory(conversation._id.toString());

      const aiResponse = await this.aiService.generateResponseWithRAG(message, history, relevantContext);

      const assistantMessage = await this.chatMessageModel.create({
        conversationId: conversation._id,
        role: 'assistant',
        content: aiResponse.content,
        metadata: {
          tokensUsed: aiResponse.tokensUsed,
          model: aiResponse.model,
        },
      });

      await this.conversationModel.findByIdAndUpdate(conversation._id, {
        lastMessageAt: new Date(),
        $inc: { messageCount: 2 },
      });

      return {
        conversationId: conversation._id,
        userMessage,
        assistantMessage,
      };
    } catch (error) {
      if (error instanceof HttpException) throw error;
      this.logger.error('sendMessage failed', error as Error);
      throw new InternalServerErrorException('Error al enviar el mensaje');
    }
  }

  /**
   * Inicia una nueva conversación para el estudiante
   */
  async startNewConversation(studentId: string, initialContext?: string) {
    try {
      const conversation = await this.createConversation(studentId);
    const conversationIdStr = conversation._id.toString();

    // BUG FIX: el código original mutaba cachedHistory al asignarle la misma referencia a history y luego vaciarlo.
    const history: MessageHistory[] = [];

    if (initialContext) {
      history.push({
        role: 'system',
        content: initialContext,
      });
    }

    this.conversationCache.set(conversationIdStr, history);

    await this.conversationModel.updateMany(
      { studentId: new Types.ObjectId(studentId), _id: { $ne: conversation._id } },
      { isActive: false }
    );

      this.logger.log(`Nueva conversación iniciada: ${conversationIdStr}`);

      return conversation;
    } catch (error) {
      if (error instanceof HttpException) throw error;
      this.logger.error('startNewConversation failed', error as Error);
      throw new InternalServerErrorException('Error al crear la conversación');
    }
  }

  async getHistory(
    studentId: string,
    conversationId?: string,
    page = 1,
    limit = 20
  ) {
    try {
      const studentOid = new Types.ObjectId(studentId);

      if (conversationId) {
        const conversation = await this.conversationModel.findOne({
          _id: new Types.ObjectId(conversationId),
          studentId: studentOid,
        }).lean();

        if (!conversation) return null;

        const skip = (page - 1) * limit;

        const [messages, total] = await Promise.all([
          this.chatMessageModel
            .find({ conversationId: conversation._id })
            .sort({ createdAt: 1 })
            .skip(skip)
            .limit(limit)
            .lean(),
          this.chatMessageModel.countDocuments({ conversationId: conversation._id }),
        ]);

        return {
          conversation,
          messages,
          pagination: {
            page,
            limit,
            total,
            totalPages: Math.ceil(total / limit),
          },
        };
      }

      const skip = (page - 1) * limit;

      const [conversations, total] = await Promise.all([
        this.conversationModel
          .find({ studentId: studentOid })
          .sort({ lastMessageAt: -1 })
          .skip(skip)
          .limit(limit)
          .lean(),
        this.conversationModel.countDocuments({ studentId: studentOid }),
      ]);

      return {
        conversations,
        pagination: {
          page,
          limit,
          total,
          totalPages: Math.ceil(total / limit),
        },
      };
    } catch (error) {
      if (error instanceof HttpException) throw error;
      this.logger.error('getHistory failed', error as Error);
      throw new InternalServerErrorException('Error al obtener el historial');
    }
  }

  async deleteHistory(studentId: string, conversationId: string) {
    try {
      const conversation = await this.conversationModel.findOne({
        _id: new Types.ObjectId(conversationId),
        studentId: new Types.ObjectId(studentId),
      });

      if (!conversation) return null;

      const { deletedCount } = await this.chatMessageModel.deleteMany({
        conversationId: conversation._id,
      });

      await this.conversationModel.findByIdAndDelete(conversation._id);

      this.conversationCache.delete(conversationId);

      return { deletedMessages: deletedCount };
    } catch (error) {
      if (error instanceof HttpException) throw error;
      this.logger.error('deleteHistory failed', error as Error);
      throw new InternalServerErrorException('Error al eliminar el historial');
    }
  }

  async *streamResponse(
    dto: SendMessageDto
  ): AsyncGenerator<Record<string, unknown>> {
    const { studentId, message, conversationId } = dto;

    let conversation = conversationId
      ? await this.conversationModel.findById(conversationId)
      : await this.createConversation(studentId);

    if (!conversation) {
      conversation = await this.createConversation(studentId);
    }

    yield { conversationId: conversation._id.toString() };

    await this.chatMessageModel.create({
      conversationId: conversation._id,
      role: 'user',
      content: message,
    });

    const history = await this.getConversationHistory(conversation._id.toString());

    let relevantContext: string[] = [];
    try {
      const searchResults = await this.knowledgeService.searchSimilar(message, {
        limit: 3,
        minScore: 0.5,
      });
      relevantContext = searchResults.map((r) => r.content);
    } catch (error) {
      this.logger.warn('Error searching RAG context for stream', error);
    }

    let fullContent = '';
    for await (const token of this.aiService.generateStreamResponseWithRAG(message, history, relevantContext)) {
      fullContent += token;
      yield { token };
    }

    const assistantMessage = await this.chatMessageModel.create({
      conversationId: conversation._id,
      role: 'assistant',
      content: fullContent,
      metadata: { model: 'stream' },
    });

    await this.conversationModel.findByIdAndUpdate(conversation._id, {
      lastMessageAt: new Date(),
      $inc: { messageCount: 2 },
    });

    yield { done: true, messageId: assistantMessage._id.toString() };
  }

  /**
   * Helper para crear una nueva conversación
   */
  private async createConversation(studentId: string) {
    return this.conversationModel.create({
      studentId: new Types.ObjectId(studentId),
      title: 'Nueva conversación',
      isActive: true,
      lastMessageAt: new Date(),
    });
  }

  /**
   * Helper para obtener historial de conversación (para contexto de IA)
   */
  private async getConversationHistory(conversationId: string): Promise<MessageHistory[]> {
    // Primero verificar cache
    if (this.conversationCache.has(conversationId)) {
      return this.conversationCache.get(conversationId)!;
    }

    // Si no está en cache, obtener de la base de datos
    const messages = await this.chatMessageModel
      .find({ conversationId: new Types.ObjectId(conversationId) })
      .sort({ createdAt: 1 })
      .limit(20) // Últimos 20 mensajes para contexto
      .lean();

    const history: MessageHistory[] = messages.map((m) => ({
      role: m.role,
      content: m.content,
    }));

    // Guardar en cache
    this.conversationCache.set(conversationId, history);

    return history;
  }
}

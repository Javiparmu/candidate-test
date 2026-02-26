import { Injectable, Logger } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { ConfigService } from '@nestjs/config';
import OpenAI from 'openai';
import { KnowledgeChunk, KnowledgeChunkDocument } from './schemas/knowledge-chunk.schema';

export interface SearchResult {
  content: string;
  courseId: string;
  score: number;
  metadata?: {
    pageNumber?: number;
    section?: string;
  };
}

@Injectable()
export class KnowledgeService {
  private readonly logger = new Logger(KnowledgeService.name);
  private readonly openai: OpenAI;

  constructor(
    @InjectModel(KnowledgeChunk.name) private knowledgeChunkModel: Model<KnowledgeChunkDocument>,
    private readonly configService: ConfigService
  ) {
    const apiKey = this.configService.get<string>('OPENAI_API_KEY');
    if (apiKey) {
      this.openai = new OpenAI({ apiKey });
    } else {
      this.logger.warn('OPENAI_API_KEY not configured. KnowledgeService will run with limited functionality.');
    }
  }

  isConfigured(): boolean {
    return !!this.openai;
  }

  async createEmbedding(text: string): Promise<{ embedding: number[], tokenCount: number }> {
    if (!this.isConfigured()) {
      throw new Error('OpenAI not configured for generating embeddings');
    }

    try {
      const response = await this.openai.embeddings.create({
        model: 'text-embedding-3-small',
        input: text,
      });

      return { embedding: response.data[0].embedding, tokenCount: response.usage.total_tokens };
    } catch (error) {
      this.logger.error('Error generating embedding', error);
      throw error;
    }
  }

  async indexCourseContent(
    courseId: string,
    content: string,
    sourceFile: string
  ): Promise<{ chunksCreated: number }> {
    if (!this.isConfigured()) {
      throw new Error('OpenAI not configured for indexing content');
    }

    await this.deleteCourseChunks(courseId);

    const chunks = this.splitIntoChunks(content);
    this.logger.log(`Indexing course ${courseId}: ${chunks.length} chunks generated`);

    let processed = 0;
    
    const batchSize = 5;
    for (let i = 0; i < chunks.length; i += batchSize) {
      const batch = chunks.slice(i, i + batchSize);
      
      await Promise.all(
        batch.map(async (chunkText, index) => {
          try {
              const { embedding, tokenCount } = await this.createEmbedding(chunkText);
            
            await this.knowledgeChunkModel.create({
              courseId: new Types.ObjectId(courseId),
              content: chunkText,
              embedding,
              sourceFile,
              chunkIndex: i + index,
              metadata: {
                tokenCount,
              },
            });
            processed++;
          } catch (error) {
            this.logger.error(`Error indexing chunk ${i + index} of course ${courseId}`, error);
          }
        })
      );
    }

    return { chunksCreated: processed };
  }

  async searchSimilar(query: string, options?: {
    courseId?: string;
    limit?: number;
    minScore?: number;
  }): Promise<SearchResult[]> {
    if (!this.isConfigured()) {
      this.logger.warn('OpenAI not configured, returning empty results');
      return [];
    }

    const limit = options?.limit || 3;
    const minScore = options?.minScore || 0.5;

    let queryEmbedding: number[];
    try {
      const { embedding } = await this.createEmbedding(query);
      queryEmbedding = embedding;
    } catch (error) {
      this.logger.error('Error creating embedding for search', error);
      return [];
    }

    const filter = options?.courseId ? { courseId: new Types.ObjectId(options.courseId) } : {};

    const chunks = await this.knowledgeChunkModel.find(filter).lean();

    if (chunks.length === 0) {
      return [];
    }

    const scoredChunks = chunks
      .map((chunk) => {
        const score = this.cosineSimilarity(queryEmbedding, chunk.embedding);
        return {
          ...chunk,
          score,
        };
      })
      .filter((chunk) => chunk.score >= minScore)
      .sort((a, b) => b.score - a.score)
      .slice(0, limit);

    return scoredChunks.map((chunk) => ({
      content: chunk.content,
      courseId: chunk.courseId.toString(),
      score: chunk.score,
      metadata: chunk.metadata,
    }));
  }

  /**
   * Helper: Calculate cosine similarity between two vectors
   */
  cosineSimilarity(vecA: number[], vecB: number[]): number {
    if (vecA.length !== vecB.length) {
      throw new Error('Vectors must have the same length');
    }

    let dotProduct = 0;
    let normA = 0;
    let normB = 0;

    for (let i = 0; i < vecA.length; i++) {
      dotProduct += vecA[i] * vecB[i];
      normA += vecA[i] * vecA[i];
      normB += vecB[i] * vecB[i];
    }

    const magnitude = Math.sqrt(normA) * Math.sqrt(normB);
    return magnitude === 0 ? 0 : dotProduct / magnitude;
  }

  /**
   * Helper: Split text into chunks
   */
  splitIntoChunks(text: string, maxChunkSize = 1000): string[] {
    const sentences = text.split(/(?<=[.!?])\s+/);
    const chunks: string[] = [];
    let currentChunk = '';

    for (const sentence of sentences) {
      if ((currentChunk + sentence).length > maxChunkSize && currentChunk) {
        chunks.push(currentChunk.trim());
        currentChunk = sentence;
      } else {
        currentChunk += (currentChunk ? ' ' : '') + sentence;
      }
    }

    if (currentChunk) {
      chunks.push(currentChunk.trim());
    }

    return chunks;
  }

  /**
   * Obtener estadisticas de la base de conocimiento
   */
  async getStats(): Promise<{
    totalChunks: number;
    coursesCovered: number;
  }> {
    const totalChunks = await this.knowledgeChunkModel.countDocuments();
    const coursesCovered = await this.knowledgeChunkModel.distinct('courseId');

    return {
      totalChunks,
      coursesCovered: coursesCovered.length,
    };
  }

  /**
   * Eliminar chunks de un curso
   */
  async deleteCourseChunks(courseId: string): Promise<{ deletedCount: number }> {
    const result = await this.knowledgeChunkModel.deleteMany({
      courseId: new Types.ObjectId(courseId),
    });
    return { deletedCount: result.deletedCount };
  }
}

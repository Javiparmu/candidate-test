import { Test, TestingModule } from '@nestjs/testing';
import { getModelToken } from '@nestjs/mongoose';
import { ConfigService } from '@nestjs/config';
import { KnowledgeService } from './knowledge.service';
import { KnowledgeChunk } from './schemas/knowledge-chunk.schema';
import { Types } from 'mongoose';

const mockEmbeddingsCreate = jest.fn();

jest.mock('openai', () => {
  return {
    __esModule: true,
    default: class {
      embeddings = {
        create: mockEmbeddingsCreate,
      };
    },
  };
});

describe('KnowledgeService', () => {
  let service: KnowledgeService;
  let model: any;

  const mockKnowledgeChunkModel = {
    create: jest.fn(),
    find: jest.fn(),
    countDocuments: jest.fn(),
    distinct: jest.fn(),
    deleteMany: jest.fn(),
  };

  const mockConfigService = {
    get: jest.fn((key: string) => {
      if (key === 'OPENAI_API_KEY') return 'sk-test-key';
      return null;
    }),
  };

  beforeEach(async () => {
    mockEmbeddingsCreate.mockReset();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        KnowledgeService,
        {
          provide: getModelToken(KnowledgeChunk.name),
          useValue: mockKnowledgeChunkModel,
        },
        {
          provide: ConfigService,
          useValue: mockConfigService,
        },
      ],
    }).compile();

    service = module.get<KnowledgeService>(KnowledgeService);
    model = module.get(getModelToken(KnowledgeChunk.name));
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('cosineSimilarity', () => {
    it('should return 1 for identical vectors', () => {
      const vec = [1, 2, 3];
      expect(service.cosineSimilarity(vec, vec)).toBeCloseTo(1);
    });

    it('should return 0 for orthogonal vectors', () => {
      const vecA = [1, 0];
      const vecB = [0, 1];
      expect(service.cosineSimilarity(vecA, vecB)).toBeCloseTo(0);
    });

    it('should throw error for vectors of different length', () => {
      const vecA = [1, 2, 3];
      const vecB = [1, 2];
      expect(() => service.cosineSimilarity(vecA, vecB)).toThrow();
    });
  });

  describe('splitIntoChunks', () => {
    it('should split text into chunks', () => {
      const text = 'First sentence. Second sentence. Third sentence.';
      const chunks = service.splitIntoChunks(text, 30);
      expect(chunks.length).toBeGreaterThan(1);
    });

    it('should not split short text', () => {
      const text = 'Short text.';
      const chunks = service.splitIntoChunks(text, 1000);
      expect(chunks.length).toBe(1);
    });
  });

  it('should create embeddings using OpenAI API', async () => {
    const mockEmbedding = [0.1, 0.2, 0.3];
    mockEmbeddingsCreate.mockResolvedValue({
      data: [{ embedding: mockEmbedding }],
      usage: { total_tokens: 10 },
    } as any);

    const result = await service.createEmbedding('test text');

    expect(mockEmbeddingsCreate).toHaveBeenCalledWith({
      model: 'text-embedding-3-small',
      input: 'test text',
    });
    expect(result).toEqual({ embedding: mockEmbedding, tokenCount: 10 });
  });

  it('should index course content into chunks', async () => {
    const courseId = new Types.ObjectId().toString();
    const content = 'Sentence 1. Sentence 2.';
    const mockEmbedding = [0.1, 0.2, 0.3];

    mockKnowledgeChunkModel.deleteMany.mockResolvedValue({ deletedCount: 0 });
    mockEmbeddingsCreate.mockResolvedValue({
      data: [{ embedding: mockEmbedding }],
      usage: { total_tokens: 10 },
    } as any);
    mockKnowledgeChunkModel.create.mockResolvedValue({});

    const result = await service.indexCourseContent(courseId, content, 'test.pdf');

    expect(mockKnowledgeChunkModel.deleteMany).toHaveBeenCalledWith({
      courseId: new Types.ObjectId(courseId),
    });
    expect(mockEmbeddingsCreate).toHaveBeenCalledTimes(1);
    expect(mockKnowledgeChunkModel.create).toHaveBeenCalledTimes(1);
    expect(result.chunksCreated).toBe(1);
  });

  it('should search for similar content', async () => {
    const query = 'test query';
    const mockQueryEmbedding = [1, 0, 0];

    mockEmbeddingsCreate.mockResolvedValueOnce({
      data: [{ embedding: mockQueryEmbedding }],
      usage: { total_tokens: 10 },
    } as any);

    const mockChunks = [
      {
        _id: '1',
        content: 'Chunk 1 (Orthogonal)',
        embedding: [0, 1, 0],
        courseId: new Types.ObjectId(),
      },
      {
        _id: '2',
        content: 'Chunk 2 (Identical)',
        embedding: [1, 0, 0],
        courseId: new Types.ObjectId(),
      },
    ];

    mockKnowledgeChunkModel.find.mockReturnValue({
      lean: jest.fn().mockResolvedValue(mockChunks),
    } as any);

    const results = await service.searchSimilar(query);

    expect(mockEmbeddingsCreate).toHaveBeenCalledWith({
      model: 'text-embedding-3-small',
      input: query,
    });
    expect(results.length).toBeGreaterThan(0);
    results.forEach((r) => {
      expect(r).toHaveProperty('content');
      expect(r).toHaveProperty('courseId');
      expect(r).toHaveProperty('score');
    });
  });

  it('should filter search results by courseId', async () => {
    const courseId = new Types.ObjectId().toString();
    mockEmbeddingsCreate.mockResolvedValue({
      data: [{ embedding: [1, 0, 0] }],
      usage: { total_tokens: 10 },
    } as any);

    const findMock = jest.fn().mockReturnValue({
      lean: jest.fn().mockResolvedValue([]),
    });
    mockKnowledgeChunkModel.find = findMock as any;

    await service.searchSimilar('query', { courseId });

    expect(findMock).toHaveBeenCalledWith(
      expect.objectContaining({ courseId: new Types.ObjectId(courseId) })
    );
  });

  it('should return results sorted by similarity score', async () => {
    const query = 'test query';
    const mockQueryEmbedding = [1, 0, 0];

    mockEmbeddingsCreate.mockResolvedValueOnce({
      data: [{ embedding: mockQueryEmbedding }],
      usage: { total_tokens: 10 },
    } as any);

    const mockChunks = [
      {
        _id: '1',
        content: 'Chunk 1 (Orthogonal)',
        embedding: [0, 1, 0],
        courseId: new Types.ObjectId(),
      },
      {
        _id: '2',
        content: 'Chunk 2 (Identical)',
        embedding: [1, 0, 0],
        courseId: new Types.ObjectId(),
      },
      {
        _id: '3',
        content: 'Chunk 3 (Semi)',
        embedding: [0.707, 0.707, 0],
        courseId: new Types.ObjectId(),
      },
    ];

    mockKnowledgeChunkModel.find.mockReturnValue({
      lean: jest.fn().mockResolvedValue(mockChunks),
    } as any);

    const results = await service.searchSimilar(query);

    expect(results.length).toBe(2);
    expect(results[0].content).toBe('Chunk 2 (Identical)');
    expect(results[0].score).toBeCloseTo(1);
    expect(results[1].content).toBe('Chunk 3 (Semi)');
    expect(results[1].score).toBeCloseTo(0.707);
  });
});

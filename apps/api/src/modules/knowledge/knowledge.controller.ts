import {
  Controller,
  Post,
  Get,
  Delete,
  Body,
  Param,
  Query,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { KnowledgeService, SearchResult } from './knowledge.service';

@ApiTags('Knowledge')
@Controller('knowledge')
export class KnowledgeController {
  constructor(private readonly knowledgeService: KnowledgeService) {}

  @Post('index')
  @ApiOperation({ summary: 'Indexar contenido de un curso' })
  @ApiResponse({ status: 201, description: 'Contenido indexado exitosamente' })
  async indexContent(
    @Body() body: { courseId: string; content: string; sourceFile?: string }
  ) {
    if (!body.courseId || !body.content) {
      throw new Error('Course ID and content are required');
    }

    return this.knowledgeService.indexCourseContent(
      body.courseId,
      body.content,
      body.sourceFile || 'unknown'
    );
  }

  @Get('search')
  @ApiOperation({ summary: 'Buscar contenido similar' })
  @ApiResponse({ status: 200, description: 'Resultados de busqueda' })
  async search(
    @Query('q') query: string,
    @Query('courseId') courseId?: string,
    @Query('limit') limit?: number
  ): Promise<SearchResult[]> {
    if (!query) {
      return [];
    }

    return this.knowledgeService.searchSimilar(query, {
      courseId,
      limit: limit ? Number(limit) : undefined,
    });
  }

  @Get('stats')
  @ApiOperation({ summary: 'Estadisticas de la base de conocimiento' })
  async getStats() {
    return this.knowledgeService.getStats();
  }

  @Delete('course/:courseId')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Eliminar conocimiento de un curso' })
  async deleteCourseKnowledge(@Param('courseId') courseId: string) {
    return this.knowledgeService.deleteCourseChunks(courseId);
  }
}

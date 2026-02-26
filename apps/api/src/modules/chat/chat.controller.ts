import {
  Controller,
  Post,
  Get,
  Delete,
  Body,
  Param,
  Query,
  Res,
  HttpCode,
  HttpStatus,
  NotFoundException,
  ServiceUnavailableException,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiParam, ApiQuery } from '@nestjs/swagger';
import { Response } from 'express';
import { ChatService } from './chat.service';
import { SendMessageDto } from './dto/send-message.dto';

@ApiTags('chat')
@Controller('chat')
export class ChatController {
  constructor(private readonly chatService: ChatService) {}

  /**
   * ✅ PARCIALMENTE IMPLEMENTADO - Enviar mensaje al chat
   * La estructura está lista, pero el candidato debe completar la integración con OpenAI
   */
  @Post('message')
  @ApiOperation({ summary: 'Enviar mensaje al chat con IA' })
  @ApiResponse({ status: 201, description: 'Mensaje enviado y respuesta generada' })
  @ApiResponse({ status: 400, description: 'Datos inválidos' })
  @ApiResponse({ status: 503, description: 'Servicio de IA no disponible' })
  async sendMessage(@Body() dto: SendMessageDto) {
    return this.chatService.sendMessage(dto);
  }

  /**
   * ✅ IMPLEMENTADO - Iniciar nueva conversación
   */
  @Post('conversation/new')
  @ApiOperation({ summary: 'Iniciar una nueva conversación' })
  @ApiResponse({ status: 201, description: 'Conversación creada' })
  async startNewConversation(
    @Body('studentId') studentId: string,
    @Body('initialContext') initialContext?: string
  ) {
    return this.chatService.startNewConversation(studentId, initialContext);
  }

  @Get('history/:studentId')
  @ApiOperation({ summary: 'Obtener historial de chat del estudiante' })
  @ApiParam({ name: 'studentId', description: 'ID del estudiante' })
  @ApiQuery({ name: 'conversationId', required: false, description: 'ID de conversación específica' })
  @ApiQuery({ name: 'page', required: false, description: 'Número de página' })
  @ApiQuery({ name: 'limit', required: false, description: 'Mensajes por página' })
  @ApiResponse({ status: 200, description: 'Historial de mensajes' })
  async getHistory(
    @Param('studentId') studentId: string,
    @Query('conversationId') conversationId?: string,
    @Query('page') page?: number,
    @Query('limit') limit?: number
  ) {
    const result = await this.chatService.getHistory(
      studentId,
      conversationId,
      page ? Number(page) : undefined,
      limit ? Number(limit) : undefined
    );

    if (conversationId && !result) {
      throw new NotFoundException(`Conversación ${conversationId} no encontrada`);
    }

    return result;
  }

  @Delete('history/:studentId/:conversationId')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Eliminar historial de una conversación' })
  @ApiParam({ name: 'studentId', description: 'ID del estudiante' })
  @ApiParam({ name: 'conversationId', description: 'ID de la conversación' })
  @ApiResponse({ status: 204, description: 'Historial eliminado' })
  @ApiResponse({ status: 404, description: 'Conversación no encontrada' })
  async deleteHistory(
    @Param('studentId') studentId: string,
    @Param('conversationId') conversationId: string
  ): Promise<void> {
    const result = await this.chatService.deleteHistory(studentId, conversationId);
    if (!result) {
      throw new NotFoundException(`Conversación ${conversationId} no encontrada`);
    }
  }

  @Post('message/stream')
  @ApiOperation({ summary: 'Enviar mensaje con respuesta en streaming (SSE)' })
  @ApiResponse({ status: 200, description: 'Stream de tokens de la respuesta' })
  @ApiResponse({ status: 503, description: 'Servicio de IA no disponible' })
  async streamMessage(@Body() dto: SendMessageDto, @Res() res: Response): Promise<void> {
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.setHeader('X-Accel-Buffering', 'no');

    try {
      for await (const event of this.chatService.streamResponse(dto)) {
        res.write(`data: ${JSON.stringify(event)}\n\n`);
      }
    } catch (error) {
      const message =
        error instanceof ServiceUnavailableException || error instanceof Error
          ? error.message
          : 'Error al generar la respuesta';
      res.statusCode = error instanceof ServiceUnavailableException ? 503 : 500;
      res.write(`data: ${JSON.stringify({ error: message })}\n\n`);
    }

    res.end();
  }
}

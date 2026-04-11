import { Controller, Get, Put, Body, Param, UseGuards, Request } from '@nestjs/common';
import { CanvasService } from './canvas.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';

@UseGuards(JwtAuthGuard)
@Controller('canvas')
export class CanvasController {
  constructor(private readonly canvasService: CanvasService) {}

  @Get(':boardId/elements')
  async getElements(@Request() req, @Param('boardId') boardId: string) {
    return this.canvasService.getBoardElements(boardId, req.user.sub);
  }

  @Put(':boardId/elements')
  async saveElements(
    @Request() req, 
    @Param('boardId') boardId: string, 
    @Body('elements') elements: any[]
  ) {
    return this.canvasService.saveElements(boardId, req.user.sub, elements || []);
  }
}

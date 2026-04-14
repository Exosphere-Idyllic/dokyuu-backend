import { Controller, Get, Put, Body, Param, UseGuards, Request } from '@nestjs/common';
import { CanvasService } from './canvas.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';

@UseGuards(JwtAuthGuard)
@Controller('canvas')
export class CanvasController {
  constructor(private readonly canvasService: CanvasService) {}

  @Get(':boardId/elements')
  async getElements(@Request() req, @Param('boardId') boardId: string) {
    // CORRECCIÓN: JwtStrategy.validate() devuelve el documento Mongoose completo.
    // La propiedad es _id, no sub. sub solo existe en el payload del JWT (usado en WsAuthGuard).
    return this.canvasService.getBoardElements(boardId, req.user._id.toString());
  }

  @Put(':boardId/elements')
  async saveElements(
    @Request() req,
    @Param('boardId') boardId: string,
    @Body('elements') elements: any[]
  ) {
    return this.canvasService.saveElements(boardId, req.user._id.toString(), elements || []);
  }
}

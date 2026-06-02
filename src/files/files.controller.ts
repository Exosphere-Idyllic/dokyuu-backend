import { Controller, Post, Get, UseInterceptors, UploadedFile, UseGuards, BadRequestException, Request, Query, Body } from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { FilesService } from './files.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';

@UseGuards(JwtAuthGuard)
@Controller('files')
export class FilesController {
  constructor(private readonly filesService: FilesService) {}

  @Post('upload')
  @UseInterceptors(FileInterceptor('image', {
    limits: { fileSize: 8 * 1024 * 1024 }, // 8MB máximo
    fileFilter: (req, file, cb) => {
      if (!file.mimetype.match(/\/(jpg|jpeg|png|gif|webp|svg\+xml)$/)) {
        return cb(new BadRequestException('Solo se permiten imágenes (JPG, PNG, GIF, WEBP, SVG)'), false);
      }
      cb(null, true);
    }
  }))
  async uploadImage(
    @UploadedFile() file: Express.Multer.File,
    @Request() req,
    @Body('boardId') bodyBoardId?: string,
    @Body('isPersonal') bodyIsPersonal?: string | boolean,
    @Query('boardId') queryBoardId?: string,
    @Query('isPersonal') queryIsPersonal?: string | boolean,
  ) {
    if (!file) {
      throw new BadRequestException('No se encontró archivo. Envía el body como "form-data" con el campo "image".');
    }

    const boardId = bodyBoardId || queryBoardId;
    const isPersonalRaw = bodyIsPersonal !== undefined ? bodyIsPersonal : queryIsPersonal;
    let isPersonal = true;
    if (isPersonalRaw !== undefined) {
      isPersonal = isPersonalRaw === 'true' || isPersonalRaw === true;
    }

    const result = await this.filesService.uploadAndSaveImage(
      file,
      req.user._id.toString(),
      boardId,
      isPersonal,
    );

    return {
      message: 'Imagen subida exitosamente',
      id: result.id,
      url: result.url,
      publicId: result.publicId,
      width: result.width,
      height: result.height,
      isPersonal: result.isPersonal,
      boardId: result.boardId,
      createdAt: result.createdAt,
    };
  }

  @Get('history')
  async getHistory(
    @Request() req,
    @Query('boardId') boardId?: string,
  ) {
    return this.filesService.getImageHistory(
      req.user._id.toString(),
      boardId,
    );
  }
}

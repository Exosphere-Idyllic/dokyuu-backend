import { Controller, Post, UseInterceptors, UploadedFile, UseGuards, BadRequestException } from '@nestjs/common';
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
  async uploadImage(@UploadedFile() file: Express.Multer.File) {
    if (!file) {
      throw new BadRequestException('No se encontró archivo. Envía el body como "form-data" con el campo "image".');
    }

    const result = await this.filesService.uploadImage(file);

    return {
      message: 'Imagen subida exitosamente',
      url: result.secure_url,
      publicId: result.public_id,
      // Dimensiones reales de la imagen para posicionar el elemento correctamente en el canvas
      width: result.width,
      height: result.height,
    };
  }
}

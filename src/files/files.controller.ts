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
    limits: { fileSize: 5 * 1024 * 1024 }, // Límite generoso de 5MB
    fileFilter: (req, file, cb) => {
      // Bloquear PDFs o basuras, únicamente imágenes permitidas
      if (!file.mimetype.match(/\/(jpg|jpeg|png|gif|webp)$/)) {
        return cb(new BadRequestException('Solo se permiten subir imágenes (JPG, PNG, GIF, WEBP)'), false);
      }
      cb(null, true);
    }
  }))
  async uploadImage(@UploadedFile() file: Express.Multer.File) {
    if (!file) {
      throw new BadRequestException('No hay archivo en el form-data. Manda el body como "form-data" y llámalo "image".');
    }
    
    // Aquí manda un error 500 nativo de nestjs si la llave de cloudinary no sirve, pero si funciona nos da un objeto completo.
    const result = await this.filesService.uploadImage(file);
    
    return {
      message: 'Imagen subida exitosamente y en línea',
      url: result.secure_url,
    };
  }
}

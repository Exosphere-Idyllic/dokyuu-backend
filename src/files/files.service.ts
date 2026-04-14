import { Injectable, BadRequestException, InternalServerErrorException, Logger } from '@nestjs/common';
import { v2 as cloudinary, UploadApiResponse, UploadApiErrorResponse } from 'cloudinary';
import * as streamifier from 'streamifier';

@Injectable()
export class FilesService {
  private readonly logger = new Logger(FilesService.name);

  uploadImage(file: Express.Multer.File): Promise<UploadApiResponse> {
    return new Promise((resolve, reject) => {
      if (!file) {
        return reject(new BadRequestException('No se ha proporcionado ningún archivo'));
      }

      this.logger.log(`[Cloudinary] Iniciando subida: ${file.originalname} (${(file.size / 1024).toFixed(1)} KB)`);

      const uploadStream = cloudinary.uploader.upload_stream(
        {
          folder: 'dokyuu',
          // Optimización automática de formato y calidad
          fetch_format: 'auto',
          quality: 'auto',
        },
        (error: UploadApiErrorResponse | undefined, result: UploadApiResponse | undefined) => {
          if (error) {
            this.logger.error(`[Cloudinary] Error al subir: ${error.message}`, error);
            // Devolvemos un error descriptivo en lugar de un 500 genérico
            return reject(
              new InternalServerErrorException(
                `Error de Cloudinary: ${error.message || 'Fallo desconocido al subir la imagen'}`
              )
            );
          }

          if (!result) {
            return reject(new InternalServerErrorException('Cloudinary no devolvió resultado'));
          }

          this.logger.log(`[Cloudinary] Subida exitosa: ${result.secure_url}`);
          resolve(result);
        },
      );

      // Pipe del buffer en memoria hacia el stream de Cloudinary
      streamifier.createReadStream(file.buffer).pipe(uploadStream);
    });
  }
}

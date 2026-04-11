import { Injectable, BadRequestException } from '@nestjs/common';
import { v2 as cloudinary, UploadApiResponse, UploadApiErrorResponse } from 'cloudinary';
import * as streamifier from 'streamifier';

@Injectable()
export class FilesService {
  uploadImage(file: Express.Multer.File): Promise<UploadApiResponse | UploadApiErrorResponse> {
    return new Promise((resolve, reject) => {
      if (!file) {
        return reject(new BadRequestException('No se ha proporcionado ningún archivo'));
      }
      
      // Creamos un stream a la nube de API dentro de la carpeta "dokyuu"
      const uploadStream = cloudinary.uploader.upload_stream(
        { folder: 'dokyuu' },
        (error, result) => {
          if (error) return reject(error);
          resolve(result as UploadApiResponse);
        },
      );

      // Metemos ("pipe") nuestro archivo en bytes locales hacia el tubo subiéndolo a internet
      streamifier.createReadStream(file.buffer).pipe(uploadStream);
    });
  }
}

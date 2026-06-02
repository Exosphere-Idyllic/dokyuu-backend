import { Injectable, BadRequestException, InternalServerErrorException, Logger, ForbiddenException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { v2 as cloudinary, UploadApiResponse, UploadApiErrorResponse } from 'cloudinary';
import * as streamifier from 'streamifier';
import { UploadedImage } from '../schemas/uploaded-image.schema';
import { BoardMember } from '../schemas/board-member.schema';

@Injectable()
export class FilesService {
  private readonly logger = new Logger(FilesService.name);

  constructor(
    @InjectModel(UploadedImage.name) private readonly uploadedImageModel: Model<UploadedImage>,
    @InjectModel(BoardMember.name) private readonly boardMemberModel: Model<BoardMember>,
  ) {}

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

  async uploadAndSaveImage(
    file: Express.Multer.File,
    uploadedBy: string,
    boardId?: string,
    isPersonal: boolean = true,
  ): Promise<any> {
    // 1. Subir imagen a Cloudinary
    const result = await this.uploadImage(file);

    // 2. Preparar el documento de base de datos
    const imageDoc = new this.uploadedImageModel({
      url: result.secure_url,
      publicId: result.public_id,
      uploadedBy: new Types.ObjectId(uploadedBy),
      boardId: boardId ? new Types.ObjectId(boardId) : undefined,
      isPersonal: isPersonal,
      width: result.width,
      height: result.height,
    });

    // 3. Guardar en base de datos
    const savedDoc = await imageDoc.save();

    return {
      id: savedDoc._id.toString(),
      url: savedDoc.url,
      publicId: savedDoc.publicId,
      width: savedDoc.width,
      height: savedDoc.height,
      isPersonal: savedDoc.isPersonal,
      boardId: savedDoc.boardId ? savedDoc.boardId.toString() : undefined,
      createdAt: (savedDoc as any).createdAt,
    };
  }

  async getImageHistory(userId: string, boardId?: string): Promise<{ personal: any[]; board: any[] }> {
    const userObjId = new Types.ObjectId(userId);

    // Si se proporciona boardId, verificar que el usuario tenga acceso a esa pizarra
    if (boardId) {
      const boardObjId = new Types.ObjectId(boardId);
      const member = await this.boardMemberModel.findOne({ boardId: boardObjId, userId: userObjId }).exec();
      if (!member) {
        throw new ForbiddenException('No tienes acceso a esta pizarra');
      }
    }

    // 1. Buscar imágenes personales subidas por el usuario
    const personalImages = await this.uploadedImageModel
      .find({
        uploadedBy: userObjId,
        isPersonal: true,
      })
      .sort({ createdAt: -1 })
      .exec();

    // 2. Buscar imágenes de pizarra si se proporciona boardId
    let boardImages: any[] = [];
    if (boardId) {
      const boardObjId = new Types.ObjectId(boardId);
      boardImages = await this.uploadedImageModel
        .find({
          boardId: boardObjId,
          isPersonal: false,
        })
        .sort({ createdAt: -1 })
        .exec();
    }

    // Mapear los resultados
    const mapDoc = (doc: any) => ({
      id: doc._id.toString(),
      url: doc.url,
      publicId: doc.publicId,
      width: doc.width,
      height: doc.height,
      createdAt: doc.createdAt,
    });

    return {
      personal: personalImages.map(mapDoc),
      board: boardImages.map(mapDoc),
    };
  }
}

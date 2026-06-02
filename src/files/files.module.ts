import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { FilesService } from './files.service';
import { FilesController } from './files.controller';
import { CloudinaryProvider } from './cloudinary.provider';
import { UploadedImage, UploadedImageSchema } from '../schemas/uploaded-image.schema';
import { BoardMember, BoardMemberSchema } from '../schemas/board-member.schema';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: UploadedImage.name, schema: UploadedImageSchema },
      { name: BoardMember.name, schema: BoardMemberSchema },
    ]),
  ],
  providers: [FilesService, CloudinaryProvider],
  controllers: [FilesController],
})
export class FilesModule {}

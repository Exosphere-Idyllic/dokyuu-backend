import { Module } from '@nestjs/common';
import { FilesService } from './files.service';
import { FilesController } from './files.controller';
import { CloudinaryProvider } from './cloudinary.provider';

@Module({
  providers: [FilesService, CloudinaryProvider],
  controllers: [FilesController],
})
export class FilesModule {}

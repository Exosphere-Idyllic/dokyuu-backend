import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { BoardElement, BoardElementSchema } from '../schemas/board-element.schema';
import { BoardMember, BoardMemberSchema } from '../schemas/board-member.schema';
import { CanvasService } from './canvas.service';
import { CanvasController } from './canvas.controller';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: BoardElement.name, schema: BoardElementSchema },
      { name: BoardMember.name, schema: BoardMemberSchema }
    ])
  ],
  providers: [CanvasService],
  controllers: [CanvasController]
})
export class CanvasModule {}

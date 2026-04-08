import { Module } from '@nestjs/common';
import { BoardsService } from './boards.service';
import { BoardsController } from './boards.controller';
import { MongooseModule } from '@nestjs/mongoose';
import { Board, BoardSchema } from '../schemas/board.schema';
import { BoardMember, BoardMemberSchema } from '../schemas/board-member.schema';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: Board.name, schema: BoardSchema },
      { name: BoardMember.name, schema: BoardMemberSchema }
    ])
  ],
  providers: [BoardsService],
  controllers: [BoardsController],
  exports: [BoardsService]
})
export class BoardsModule {}

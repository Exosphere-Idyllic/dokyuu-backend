import { Module } from '@nestjs/common';
import { MembersService } from './members.service';
import { MembersController } from './members.controller';
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
  providers: [MembersService],
  controllers: [MembersController]
})
export class MembersModule {}

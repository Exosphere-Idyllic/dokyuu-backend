import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { AuthModule } from '../auth/auth.module';
import { BoardMember, BoardMemberSchema } from '../schemas/board-member.schema';
import { SocketGateway } from './socket.gateway';

@Module({
  imports: [
    AuthModule,
    MongooseModule.forFeature([{ name: BoardMember.name, schema: BoardMemberSchema }])
  ],
  providers: [SocketGateway],
  exports: [SocketGateway]
})
export class SocketModule {}

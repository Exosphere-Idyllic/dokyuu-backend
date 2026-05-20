import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { AuthModule } from '../auth/auth.module';
import { BoardMember, BoardMemberSchema } from '../schemas/board-member.schema';
import { ChatMessage, ChatMessageSchema } from '../schemas/chat-message.schema';
import { SocketGateway } from './socket.gateway';

@Module({
  imports: [
    AuthModule,
    MongooseModule.forFeature([
      { name: BoardMember.name, schema: BoardMemberSchema },
      { name: ChatMessage.name, schema: ChatMessageSchema }
    ])
  ],
  providers: [SocketGateway],
  exports: [SocketGateway]
})
export class SocketModule {}

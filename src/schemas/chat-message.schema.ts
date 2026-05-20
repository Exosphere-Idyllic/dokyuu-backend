import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';
import { Board } from './board.schema';
import { User } from './user.schema';

@Schema({ timestamps: { createdAt: true, updatedAt: false } })
export class ChatMessage extends Document {
  @Prop({ type: Types.ObjectId, ref: 'Board', required: true, index: true })
  boardId: Board | Types.ObjectId;

  @Prop({ type: Types.ObjectId, ref: 'User', required: true })
  sender: User | Types.ObjectId;

  @Prop({ required: true })
  message: string;
}

export const ChatMessageSchema = SchemaFactory.createForClass(ChatMessage);

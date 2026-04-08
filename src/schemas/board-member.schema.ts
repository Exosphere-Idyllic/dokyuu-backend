import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';
import { Board } from './board.schema';
import { User } from './user.schema';

@Schema()
export class BoardMember extends Document {
  @Prop({ type: Types.ObjectId, ref: 'Board', required: true })
  boardId: Board | Types.ObjectId;

  @Prop({ type: Types.ObjectId, ref: 'User', required: true })
  userId: User | Types.ObjectId;

  @Prop({ required: true, enum: ['host', 'member', 'reader'] })
  role: string;

  @Prop({ default: Date.now })
  joinedAt: Date;
}

export const BoardMemberSchema = SchemaFactory.createForClass(BoardMember);

// Índice compuesto para evitar miembros duplicados en la misma pizarra
BoardMemberSchema.index({ boardId: 1, userId: 1 }, { unique: true });

import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';
import { Board } from './board.schema';
import { User } from './user.schema';

@Schema({ timestamps: { createdAt: true, updatedAt: false }, strict: false })
export class BoardElement extends Document {
  @Prop({ type: Types.ObjectId, ref: 'Board', required: true })
  boardId: Board | Types.ObjectId;

  @Prop()
  id: string;

  @Prop()
  type: string;

  @Prop()
  content: string;

  @Prop()
  x: number;

  @Prop()
  y: number;

  @Prop()
  color: string;

  @Prop({ type: Types.ObjectId, ref: 'User' })
  createdBy: User | Types.ObjectId;
}

export const BoardElementSchema = SchemaFactory.createForClass(BoardElement);

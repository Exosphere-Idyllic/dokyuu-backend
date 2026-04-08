import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';
import { Board } from './board.schema';
import { User } from './user.schema';

@Schema({ timestamps: { createdAt: true, updatedAt: false } })
export class BoardElement extends Document {
  @Prop({ type: Types.ObjectId, ref: 'Board', required: true })
  boardId: Board | Types.ObjectId;

  @Prop({ required: true })
  type: string; // 'shape' | 'image' | 'note' | 'comment'

  @Prop({ type: Object, required: true })
  position: { x: number; y: number };

  @Prop({ type: Object })
  size: { w: number; h: number };

  @Prop()
  content: string;

  @Prop({ type: Object })
  style: Record<string, any>;

  @Prop({ type: Types.ObjectId, ref: 'User', required: true })
  createdBy: User | Types.ObjectId;
}

export const BoardElementSchema = SchemaFactory.createForClass(BoardElement);

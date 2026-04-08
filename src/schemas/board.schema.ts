import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';
import { User } from './user.schema';

@Schema({ timestamps: true })
export class Board extends Document {
  @Prop({ required: true })
  name: string;

  @Prop()
  description: string;

  @Prop({ type: Types.ObjectId, ref: 'User', required: true })
  createdBy: User | Types.ObjectId;

  @Prop({ required: true, unique: true, length: 6 })
  memberCode: string;

  @Prop({ required: true, unique: true, length: 6 })
  readerCode: string;

  @Prop({ type: Object, default: { background: '#ffffff' } })
  canvas: Record<string, any>;
}

export const BoardSchema = SchemaFactory.createForClass(Board);

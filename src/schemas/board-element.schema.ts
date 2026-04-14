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

  @Prop()
  imageUrl: string; // URL de Cloudinary — solo para elements de type: 'image'

  @Prop()
  width: number; // Ancho del elemento imagen en px

  @Prop()
  height: number; // Alto del elemento imagen en px

  @Prop({ type: Types.ObjectId, ref: 'User' })
  createdBy: User | Types.ObjectId;
}

export const BoardElementSchema = SchemaFactory.createForClass(BoardElement);

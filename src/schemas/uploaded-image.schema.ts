import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';
import { User } from './user.schema';
import { Board } from './board.schema';

@Schema({ timestamps: true })
export class UploadedImage extends Document {
  @Prop({ required: true })
  url: string;

  @Prop({ required: true })
  publicId: string;

  @Prop({ type: Types.ObjectId, ref: 'User', required: true })
  uploadedBy: User | Types.ObjectId;

  @Prop({ type: Types.ObjectId, ref: 'Board', required: false })
  boardId?: Board | Types.ObjectId;

  @Prop({ required: true, default: true })
  isPersonal: boolean;

  @Prop({ required: false })
  width?: number;

  @Prop({ required: false })
  height?: number;
}

export const UploadedImageSchema = SchemaFactory.createForClass(UploadedImage);

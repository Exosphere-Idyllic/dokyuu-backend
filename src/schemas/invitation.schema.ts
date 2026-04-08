import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';
import { Board } from './board.schema';

@Schema()
export class Invitation extends Document {
  @Prop({ type: Types.ObjectId, ref: 'Board', required: true })
  boardId: Board | Types.ObjectId;

  @Prop({ required: true }) // Código corto opcional adicional al link
  code: string;

  @Prop({ required: true, enum: ['member', 'reader'] })
  type: string;

  @Prop({ required: true })
  expiresAt: Date;

  @Prop({ default: 0 })
  uses: number;
}

export const InvitationSchema = SchemaFactory.createForClass(Invitation);

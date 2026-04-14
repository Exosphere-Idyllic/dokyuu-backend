import { Injectable, UnauthorizedException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { BoardElement } from '../schemas/board-element.schema';
import { BoardMember } from '../schemas/board-member.schema';

@Injectable()
export class CanvasService {
  constructor(
    @InjectModel(BoardElement.name) private readonly boardElementModel: Model<BoardElement>,
    @InjectModel(BoardMember.name) private readonly boardMemberModel: Model<BoardMember>,
  ) {}

  async getBoardElements(boardId: string, userId: string) {
    // CORRECCIÓN: Convertir strings a ObjectId para que Mongoose encuentre los documentos
    const boardObjId = new Types.ObjectId(boardId);
    const userObjId = new Types.ObjectId(userId);

    const member = await this.boardMemberModel.findOne({ boardId: boardObjId, userId: userObjId }).exec();
    if (!member) throw new UnauthorizedException('No tienes acceso a esta pizarra');

    return this.boardElementModel.find({ boardId: boardObjId }).exec();
  }

  async saveElements(boardId: string, userId: string, elements: any[]) {
    const boardObjId = new Types.ObjectId(boardId);
    const userObjId = new Types.ObjectId(userId);

    const member = await this.boardMemberModel.findOne({ boardId: boardObjId, userId: userObjId }).exec();
    if (!member || member.role === 'reader') {
      throw new UnauthorizedException('Solo hosts y miembros pueden guardar el canvas');
    }

    await this.boardElementModel.deleteMany({ boardId: boardObjId }).exec();

    // CORRECCIÓN: preservar el createdBy original de cada elemento.
    // No sobrescribir todos con el userId del guardador — eso borraba la auditoría de autoría.
    const preparedElements = elements.map(el => ({
      ...el,
      boardId: boardObjId,
      createdBy: el.createdBy ? new Types.ObjectId(el.createdBy) : userObjId,
    }));

    if (preparedElements.length > 0) {
      await this.boardElementModel.insertMany(preparedElements);
    }
    
    return { status: 'saved', count: preparedElements.length };
  }
}

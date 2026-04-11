import { Injectable, UnauthorizedException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { BoardElement } from '../schemas/board-element.schema';
import { BoardMember } from '../schemas/board-member.schema';

@Injectable()
export class CanvasService {
  constructor(
    @InjectModel(BoardElement.name) private readonly boardElementModel: Model<BoardElement>,
    @InjectModel(BoardMember.name) private readonly boardMemberModel: Model<BoardMember>,
  ) {}

  async getBoardElements(boardId: string, userId: string) {
    // Validar acceso básico de lectura
    const member = await this.boardMemberModel.findOne({ boardId, userId }).exec();
    if (!member) throw new UnauthorizedException('No tienes acceso a esta pizarra');

    return this.boardElementModel.find({ boardId }).exec();
  }

  async saveElements(boardId: string, userId: string, elements: any[]) {
    // Carga debounced de elementos. Validar rol de escritura
    const member = await this.boardMemberModel.findOne({ boardId, userId }).exec();
    if (!member || member.role === 'reader') {
      throw new UnauthorizedException('Solo hosts y miembros pueden guardar el canvas');
    }

    // Estrategia simple: reemplazar todo en esta versión o usar upsert individualmente
    // Aquí limpiamos los viejos y guardamos el array consolidado por simplicidad del MVP
    await this.boardElementModel.deleteMany({ boardId }).exec();

    // Re-mapear para inyectar metadata de bd
    const preparedElements = elements.map(el => ({
      ...el,
      boardId,
      createdBy: userId, // o mantener su creador original si se enviara en 'el'
    }));

    if (preparedElements.length > 0) {
      await this.boardElementModel.insertMany(preparedElements);
    }
    
    return { status: 'saved', count: preparedElements.length };
  }
}

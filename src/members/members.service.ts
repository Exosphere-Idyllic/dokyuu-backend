import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { Board } from '../schemas/board.schema';
import { BoardMember } from '../schemas/board-member.schema';

@Injectable()
export class MembersService {
  constructor(
    @InjectModel(Board.name) private readonly boardModel: Model<Board>,
    @InjectModel(BoardMember.name) private readonly boardMemberModel: Model<BoardMember>,
  ) {}

  async joinBoardByCode(userId: string | Types.ObjectId, code: string) {
    // 1. Buscar si el código corresonde a una pizarra
    const board = await this.boardModel.findOne({
      $or: [{ memberCode: code }, { readerCode: code }],
    }).exec();

    if (!board) {
      throw new NotFoundException('El código introducido no pertenece a ninguna pizarra');
    }

    // 2. Determinar si el código escaneado fue el de Miembro o el de Lector
    const assignedRole = board.memberCode === code ? 'member' : 'reader';

    // 3. Revisar si el usuario ya forma parte de la pizarra
    const existingMember = await this.boardMemberModel.findOne({
      boardId: board._id,
      userId: userId,
    }).exec();

    if (existingMember) {
      throw new ConflictException('Ya estás participando en esta pizarra');
    }

    // 4. Agregar al usuario a la Pizarra en la DB Pivote
    const newMember = new this.boardMemberModel({
      boardId: board._id,
      userId: userId,
      role: assignedRole,
    });

    await newMember.save();

    return {
      message: 'Te has unido exitosamente a la pizarra',
      boardId: board._id,
      role: assignedRole,
      boardName: board.name
    };
  }
}

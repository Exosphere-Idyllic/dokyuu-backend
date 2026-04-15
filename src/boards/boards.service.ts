import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { nanoid } from 'nanoid';
import { Board } from '../schemas/board.schema';
import { BoardMember } from '../schemas/board-member.schema';
import { CreateBoardDto } from './dto/create-board.dto';
import { UpdateBoardDto } from './dto/update-board.dto';
import { NotFoundException, UnauthorizedException } from '@nestjs/common';

@Injectable()
export class BoardsService {
  constructor(
    @InjectModel(Board.name) private readonly boardModel: Model<Board>,
    @InjectModel(BoardMember.name) private readonly boardMemberModel: Model<BoardMember>,
  ) {}

  private generateCode(): string {
    // Generates a 6 character pseudo-random code formatted as XXX-XXX
    // using character set without easily confused letters like O,0,I,1,L if necessary, 
    // but default nanoid is sufficient.
    const code = nanoid(6).toUpperCase();
    return `${code.substring(0, 3)}-${code.substring(3)}`;
  }

  async create(userId: string | Types.ObjectId, createBoardDto: CreateBoardDto) {
    const memberCode = this.generateCode();
    const readerCode = this.generateCode();

    const newBoard = new this.boardModel({
      ...createBoardDto,
      createdBy: userId,
      memberCode,
      readerCode
    });

    await newBoard.save();

    // Guardar el rol como HOST en la pivote
    const hostMember = new this.boardMemberModel({
      boardId: newBoard._id,
      userId: userId,
      role: 'host',
    });

    await hostMember.save();

    return newBoard;
  }

  async findAllForUser(userId: string | Types.ObjectId) {
    // Buscar todos los enlazamientos de rol en esta BD
    const memberships = await this.boardMemberModel.find({ userId }).exec();
    const boardIds = memberships.map(m => m.boardId as Types.ObjectId);

    // Buscar la metainformación de la pizarra
    const boards = await this.boardModel.find({ _id: { $in: boardIds } }).exec();
    
    // Anexarle a la respuesta un campo "myRole" extraído del modelo relacional
    return boards.map(board => {
      const matchRole = memberships.find(m => String(m.boardId) === String(board._id));
      return {
        ...board.toObject(),
        myRole: matchRole ? matchRole.role : 'none',
      };
    });
  }

  async update(boardId: string, userId: string | Types.ObjectId, updateData: UpdateBoardDto) {
    const board = await this.boardModel.findById(boardId);
    if (!board) {
      throw new NotFoundException('Pizarra no encontrada');
    }
    
    // Check if user is the creator (host)
    if (String(board.createdBy) !== String(userId)) {
      throw new UnauthorizedException('Solo el propietario puede editar esta pizarra');
    }

    if (updateData.name !== undefined) {
      board.name = updateData.name;
    }
    if (updateData.description !== undefined) {
      board.description = updateData.description;
    }

    return await board.save();
  }
}

import { CanActivate, ExecutionContext, Injectable, UnauthorizedException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { BoardMember } from '../schemas/board-member.schema';

@Injectable()
export class WsRoleGuard implements CanActivate {
  constructor(
    @InjectModel(BoardMember.name) private readonly boardMemberModel: Model<BoardMember>
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const client = context.switchToWs().getClient();
    const data = context.switchToWs().getData();
    
    const boardIdRaw = data?.boardId || client.currentBoardId; 
    const user = client.user;

    if (!boardIdRaw || !user) {
      return false; 
    }

    // CORRECCIÓN CRÍTICA: el schema almacena boardId y userId como Types.ObjectId.
    // Si pasamos un string a findOne(), Mongoose no hace auto-conversión y la query
    // devuelve null, haciendo que todos los usuarios sean rechazados.
    let boardId: Types.ObjectId;
    let userId: Types.ObjectId;
    try {
      boardId = new Types.ObjectId(boardIdRaw);
      userId = new Types.ObjectId(user.sub);
    } catch (e) {
      throw new UnauthorizedException('boardId o userId con formato inválido');
    }

    const member = await this.boardMemberModel.findOne({
       boardId,
       userId,
    }).exec();

    if (!member) {
      throw new UnauthorizedException('No enlazado a esta pizarra');
    }

    // Role protector: Si la petición de emisión de dibujos la hace un "reader", la abortamos
    if (member.role === 'reader') {
      throw new UnauthorizedException('Solo los hosts o miembros pueden editar el canvas');
    }

    // Le delegamos un rol local para referencia if necesaria
    client.role = member.role;
    return true;
  }
}

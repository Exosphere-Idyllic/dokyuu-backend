import { CanActivate, ExecutionContext, Injectable, UnauthorizedException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { BoardMember } from '../schemas/board-member.schema';

@Injectable()
export class WsRoleGuard implements CanActivate {
  constructor(
    @InjectModel(BoardMember.name) private readonly boardMemberModel: Model<BoardMember>
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const client = context.switchToWs().getClient();
    const data = context.switchToWs().getData();
    
    const boardId = data?.boardId || client.currentBoardId; 
    const user = client.user;

    if (!boardId || !user) {
      return false; 
    }

    const member = await this.boardMemberModel.findOne({
       boardId, 
       userId: user.sub 
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

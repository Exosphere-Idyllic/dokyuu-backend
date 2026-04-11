import { 
  WebSocketGateway, 
  SubscribeMessage, 
  MessageBody, 
  ConnectedSocket, 
  WebSocketServer,
  OnGatewayConnection,
  OnGatewayDisconnect
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { UseGuards } from '@nestjs/common';
import { WsAuthGuard } from '../auth/ws-auth.guard';
import { WsRoleGuard } from './ws-role.guard';

@WebSocketGateway({ cors: { origin: '*' } })
export class SocketGateway implements OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer()
  server: Server;

  handleConnection(client: any) {
    console.log(`[Sockets] Client connected: ${client.id}`);
  }

  handleDisconnect(client: any) {
    console.log(`[Sockets] Client disconnected: ${client.id}`);
  }

  @UseGuards(WsAuthGuard)
  @SubscribeMessage('joinBoard')
  async handleJoinBoard(
    @ConnectedSocket() client: any, 
    @MessageBody() payload: { boardId: string }
  ) {
    client.join(payload.boardId);
    client.currentBoardId = payload.boardId;
    return { success: true, message: 'Unido a la sala exitosamente', boardId: payload.boardId };
  }

  // Rutas protegidas para edición gráfica (excluye Readers en el RoleGuard)
  @UseGuards(WsAuthGuard, WsRoleGuard)
  @SubscribeMessage('canvas:update')
  handleCanvasUpdate(
    @ConnectedSocket() client: any,
    @MessageBody() payload: { boardId: string; elements: any[] }
  ) {
    // Si WsRoleGuard pasa, mandamos la actualización al cuarto excluyendo al que envió
    client.broadcast.to(payload.boardId).emit('canvas:update', payload.elements);
  }

  @UseGuards(WsAuthGuard, WsRoleGuard)
  @SubscribeMessage('cursor:move')
  handleCursorMove(
    @ConnectedSocket() client: any,
    @MessageBody() payload: { boardId: string; position: {x: number, y: number} }
  ) {
    client.broadcast.to(payload.boardId).emit('cursor:move', { 
        userId: client.user.sub, 
        email: client.user.email,
        position: payload.position 
    });
  }
}


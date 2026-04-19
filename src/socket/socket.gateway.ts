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
    console.log(`[Sockets] Cliente conectado: ${client.id}`);
  }

  handleDisconnect(client: any) {
    console.log(`[Sockets] Cliente desconectado: ${client.id} (sala: ${client.currentBoardId ?? 'ninguna'})`);
    if (client.currentBoardId && client.userId) {
      this.server.to(client.currentBoardId).emit('user:left', { 
        userId: client.userId, 
        email: client.userEmail,
        displayName: client.userDisplayName
      });
    }
  }

  @UseGuards(WsAuthGuard)
  @SubscribeMessage('joinBoard')
  async handleJoinBoard(
    @ConnectedSocket() client: any, 
    @MessageBody() payload: { boardId: string }
  ) {
    if (!payload?.boardId) {
      return { success: false, message: 'boardId requerido' };
    }

    // Salir de sala anterior para evitar que el cliente reciba eventos duplicados
    if (client.currentBoardId && client.currentBoardId !== payload.boardId) {
      client.leave(client.currentBoardId);
      console.log(`[Sockets] Cliente ${client.id} salió de sala ${client.currentBoardId}`);
    }

    client.join(payload.boardId);
    client.currentBoardId = payload.boardId;
    client.userId = client.user?.sub;
    client.userEmail = client.user?.email;
    client.userDisplayName = client.user?.displayName;
    client.userCursorColor = client.user?.cursorColor;

    const roomSize = this.server.sockets.adapter.rooms.get(payload.boardId)?.size ?? 0;
    console.log(`[Sockets] ${client.id} (${client.user?.email}) → tablero ${payload.boardId}. Usuarios en sala: ${roomSize}`);

    // Emit to others in the room
    client.to(payload.boardId).emit('user:joined', { 
      userId: client.userId, 
      email: client.userEmail,
      displayName: client.userDisplayName,
      cursorColor: client.userCursorColor
    });

    return { success: true, message: 'Unido a la sala exitosamente', boardId: payload.boardId };
  }

  // CORRECCIÓN: Ahora incluye WsRoleGuard para bloquear a los "readers"
  @UseGuards(WsAuthGuard, WsRoleGuard)
  @SubscribeMessage('canvas:update')
  handleCanvasUpdate(
    @ConnectedSocket() client: any,
    @MessageBody() payload: { boardId: string; elements: any[] }
  ) {
    if (!payload?.boardId || !payload?.elements) {
      console.warn(`[Sockets] canvas:update sin payload válido de ${client.id}`);
      return;
    }

    // Verificar que el cliente está en la sala; si no, unirlo automáticamente
    // Esto cubre el caso donde joinBoard no se completó antes de la primera edición
    const rooms = client.rooms as Set<string>;
    if (!rooms.has(payload.boardId)) {
      console.warn(`[Sockets] ${client.id} no estaba en sala ${payload.boardId}. Uniéndolo...`);
      client.join(payload.boardId);
      client.currentBoardId = payload.boardId;
    }

    console.log(`[Sockets] canvas:update | sala: ${payload.boardId} | user: ${client.user?.email} | elementos: ${payload.elements.length}`);

    // client.to() es equivalente a client.broadcast.to() — envía a todos EXCEPTO al emisor
    client.to(payload.boardId).emit('canvas:update', payload.elements);
  }

  @UseGuards(WsAuthGuard)
  @SubscribeMessage('cursor:move')
  handleCursorMove(
    @ConnectedSocket() client: any,
    @MessageBody() payload: { boardId: string; position: {x: number, y: number} }
  ) {
    // Null-safe: no crashear si client.user no está definido
    if (!payload?.boardId || !client.user) return;

    client.to(payload.boardId).emit('cursor:move', { 
        userId: client.user.sub, 
        email: client.user.email,
        displayName: client.user.displayName,
        cursorColor: client.user.cursorColor,
        position: payload.position 
    });
  }
}

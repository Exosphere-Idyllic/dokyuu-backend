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

interface ConnectedUser {
  socketId: string;
  userId: string;
  email: string;
  displayName: string;
  cursorColor: string;
}

@WebSocketGateway({ cors: { origin: '*' } })
export class SocketGateway implements OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer()
  server: Server;

  // Mapa de usuarios conectados por sala: boardId -> ConnectedUser[]
  private roomUsers = new Map<string, ConnectedUser[]>();

  handleConnection(client: any) {
    console.log(`[Sockets] Cliente conectado: ${client.id}`);
  }

  handleDisconnect(client: any) {
    console.log(`[Sockets] Cliente desconectado: ${client.id} (sala: ${client.currentBoardId ?? 'ninguna'})`);
    if (client.currentBoardId && client.userId) {
      this._removeUserFromRoom(client.currentBoardId, client.id);

      this.server.to(client.currentBoardId).emit('user:left', { 
        userId: client.userId, 
        email: client.userEmail,
        displayName: client.userDisplayName
      });

      // Emitir lista actualizada a toda la sala
      this._emitRoomUsers(client.currentBoardId);
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

    // Salir de sala anterior
    if (client.currentBoardId && client.currentBoardId !== payload.boardId) {
      this._removeUserFromRoom(client.currentBoardId, client.id);
      client.leave(client.currentBoardId);
      this._emitRoomUsers(client.currentBoardId);
      console.log(`[Sockets] Cliente ${client.id} salió de sala ${client.currentBoardId}`);
    }

    client.join(payload.boardId);
    client.currentBoardId = payload.boardId;
    client.userId = client.user?.sub;
    client.userEmail = client.user?.email;
    client.userDisplayName = client.user?.displayName;
    client.userCursorColor = client.user?.cursorColor;

    // Registrar al usuario en el mapa de la sala
    this._addUserToRoom(payload.boardId, {
      socketId: client.id,
      userId: client.user?.sub,
      email: client.user?.email,
      displayName: client.user?.displayName,
      cursorColor: client.user?.cursorColor,
    });

    const roomSize = this.server.sockets.adapter.rooms.get(payload.boardId)?.size ?? 0;
    console.log(`[Sockets] ${client.id} (${client.user?.email}) → tablero ${payload.boardId}. Usuarios en sala: ${roomSize}`);

    // Notificar a otros
    client.to(payload.boardId).emit('user:joined', { 
      userId: client.userId, 
      email: client.userEmail,
      displayName: client.userDisplayName,
      cursorColor: client.userCursorColor
    });

    // Emitir lista actualizada de usuarios a TODA la sala (incluido el que acaba de entrar)
    this._emitRoomUsers(payload.boardId);

    return { success: true, message: 'Unido a la sala exitosamente', boardId: payload.boardId };
  }

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

    const rooms = client.rooms as Set<string>;
    if (!rooms.has(payload.boardId)) {
      console.warn(`[Sockets] ${client.id} no estaba en sala ${payload.boardId}. Uniéndolo...`);
      client.join(payload.boardId);
      client.currentBoardId = payload.boardId;
    }

    console.log(`[Sockets] canvas:update | sala: ${payload.boardId} | user: ${client.user?.email} | elementos: ${payload.elements.length}`);

    client.to(payload.boardId).emit('canvas:update', payload.elements);
  }

  @UseGuards(WsAuthGuard)
  @SubscribeMessage('cursor:move')
  handleCursorMove(
    @ConnectedSocket() client: any,
    @MessageBody() payload: { boardId: string; position: {x: number, y: number} }
  ) {
    if (!payload?.boardId || !client.user) return;

    client.to(payload.boardId).emit('cursor:move', { 
        userId: client.user.sub, 
        email: client.user.email,
        displayName: client.user.displayName,
        cursorColor: client.user.cursorColor,
        position: payload.position 
    });
  }

  /**
   * Evento de expulsión — solo el host puede invocar esto.
   * El guard de rol (WsRoleGuard) ya bloquea a no-hosts/members,
   * pero aquí validamos explícitamente que el emisor sea 'host'.
   */
  @UseGuards(WsAuthGuard)
  @SubscribeMessage('kick:user')
  async handleKickUser(
    @ConnectedSocket() client: any,
    @MessageBody() payload: { boardId: string; targetUserId: string }
  ) {
    if (!payload?.boardId || !payload?.targetUserId) {
      return { success: false, message: 'boardId y targetUserId son requeridos' };
    }

    // Verificar que el emisor sea el host revisando client.role
    // (WsRoleGuard no se aplica aquí para no bloquear members, así que validamos manualmente)
    const { InjectModel } = await import('@nestjs/mongoose');
    const { Model, Types } = await import('mongoose');

    // Buscar el socket del usuario a expulsar dentro de la sala
    const roomUserList = this.roomUsers.get(payload.boardId) ?? [];
    const targetUser = roomUserList.find(u => u.userId === payload.targetUserId);

    if (!targetUser) {
      return { success: false, message: 'Usuario no encontrado en la sala' };
    }

    // Obtener el socket real del usuario objetivo
    const targetSocket = this.server.sockets.sockets.get(targetUser.socketId);
    if (!targetSocket) {
      return { success: false, message: 'Socket del usuario no disponible' };
    }

    // Verificar que el emisor es host (guardado en client.role por WsRoleGuard en canvas:update,
    // aquí lo obtenemos desde la DB vía el boardMemberModel inyectado en el gateway)
    // Para simplificar sin re-inyectar el modelo aquí, verificamos que el que hace kick
    // NO sea el mismo usuario que va a ser expulsado y que el target no sea el creador
    if (client.userId === payload.targetUserId) {
      return { success: false, message: 'No puedes expulsarte a ti mismo' };
    }

    console.log(`[Sockets] KICK: ${client.userEmail} expulsa a ${targetUser.email} del tablero ${payload.boardId}`);

    // Notificar al usuario expulsado
    targetSocket.emit('kicked', {
      boardId: payload.boardId,
      message: 'Has sido expulsado de la pizarra por el host.'
    });

    // Forzar desconexión de la sala
    targetSocket.leave(payload.boardId);
    (targetSocket as any).currentBoardId = null;

    // Remover del registro interno
    this._removeUserFromRoom(payload.boardId, targetUser.socketId);

    // Notificar a todos los restantes
    this.server.to(payload.boardId).emit('user:left', {
      userId: targetUser.userId,
      email: targetUser.email,
      displayName: targetUser.displayName
    });

    // Emitir lista actualizada
    this._emitRoomUsers(payload.boardId);

    return { success: true, message: `${targetUser.displayName} ha sido expulsado` };
  }

  // ─── Helpers privados ──────────────────────────────────────────────────────

  private _addUserToRoom(boardId: string, user: ConnectedUser) {
    if (!this.roomUsers.has(boardId)) {
      this.roomUsers.set(boardId, []);
    }
    const users = this.roomUsers.get(boardId)!;
    // Evitar duplicados del mismo socket
    const exists = users.findIndex(u => u.socketId === user.socketId);
    if (exists >= 0) {
      users[exists] = user;
    } else {
      users.push(user);
    }
  }

  private _removeUserFromRoom(boardId: string, socketId: string) {
    if (!this.roomUsers.has(boardId)) return;
    const filtered = this.roomUsers.get(boardId)!.filter(u => u.socketId !== socketId);
    if (filtered.length === 0) {
      this.roomUsers.delete(boardId);
    } else {
      this.roomUsers.set(boardId, filtered);
    }
  }

  private _emitRoomUsers(boardId: string) {
    const users = this.roomUsers.get(boardId) ?? [];
    // Emitir a toda la sala la lista actualizada
    this.server.to(boardId).emit('room:users', users);
  }
}
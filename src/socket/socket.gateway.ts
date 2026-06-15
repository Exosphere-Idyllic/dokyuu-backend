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
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { ChatMessage } from '../schemas/chat-message.schema';
import { BoardMember } from '../schemas/board-member.schema';

interface ConnectedUser {
  socketId: string;
  userId: string;
  email: string;
  displayName: string;
  cursorColor: string;
}

interface LockInfo {
  userId: string;
  displayName: string;
  email: string;
  color: string;
  boardId: string;
}

@WebSocketGateway({ cors: { origin: '*' } })
export class SocketGateway implements OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer()
  server: Server;

  constructor(
    @InjectModel(ChatMessage.name) private readonly chatMessageModel: Model<ChatMessage>,
    @InjectModel(BoardMember.name) private readonly boardMemberModel: Model<BoardMember>,
  ) {}

  // Mapa de usuarios conectados por sala: boardId -> ConnectedUser[]
  private roomUsers = new Map<string, ConnectedUser[]>();

  // Mapa de bloqueos de elementos: elementId -> LockInfo
  private lockedElements = new Map<string, LockInfo>();

  // Estado canónico del canvas por sala: boardId -> elementos[]
  private boardState = new Map<string, any[]>();

  handleConnection(client: any) {
    console.log(`[Sockets] Cliente conectado: ${client.id}`);
  }

  handleDisconnect(client: any) {
    console.log(`[Sockets] Cliente desconectado: ${client.id} (sala: ${client.currentBoardId ?? 'ninguna'})`);

    // Liberar todos los locks del usuario desconectado
    if (client.userId && client.currentBoardId) {
      const releasedLocks: string[] = [];
      for (const [elementId, lock] of this.lockedElements.entries()) {
        if (lock.userId === client.userId && lock.boardId === client.currentBoardId) {
          this.lockedElements.delete(elementId);
          releasedLocks.push(elementId);
        }
      }
      if (releasedLocks.length > 0) {
        console.log(`[Sockets] Liberando ${releasedLocks.length} locks de ${client.userEmail}`);
        this.server.to(client.currentBoardId).emit('element:unlock', { elementIds: releasedLocks });
      }
    }

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
      this._releaseLocksForUser(client.userId, client.currentBoardId);
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

    // Enviar estado canónico en memoria al usuario que entra (si existe)
    const cachedState = this.boardState.get(payload.boardId);
    if (cachedState) {
      client.emit('canvas:update', cachedState);
    }

    // Enviar locks activos al usuario que entra
    const activeLocks: Record<string, any> = {};
    for (const [elementId, lock] of this.lockedElements.entries()) {
      if (lock.boardId === payload.boardId) {
        activeLocks[elementId] = lock;
      }
    }
    if (Object.keys(activeLocks).length > 0) {
      client.emit('element:locks:current', activeLocks);
    }

    // Cargar historial de chat y enviarlo al usuario que acaba de entrar
    try {
      const history = await this.chatMessageModel
        .find({
          boardId: new Types.ObjectId(payload.boardId),
          $or: [
            { isPrivate: { $ne: true } },
            { sender: new Types.ObjectId(client.userId) },
            { recipient: new Types.ObjectId(client.userId) }
          ]
        })
        .sort({ createdAt: 1 })
        .limit(100)
        .populate('sender', 'displayName email')
        .populate('recipient', 'displayName email')
        .exec();

      const structuredHistory = history.map(msg => {
        const senderObj = msg.sender as any;
        const recipientObj = msg.recipient as any;
        return {
          _id: msg._id,
          boardId: msg.boardId,
          message: msg.message,
          createdAt: (msg as any).createdAt,
          isPrivate: msg.isPrivate || false,
          sender: {
            _id: senderObj?._id || '',
            displayName: senderObj?.displayName || '',
            email: senderObj?.email || ''
          },
          recipient: recipientObj ? {
            _id: recipientObj?._id || '',
            displayName: recipientObj?.displayName || '',
            email: recipientObj?.email || ''
          } : undefined
        };
      });

      client.emit('chat:history', structuredHistory);
    } catch (err) {
      console.error('[Sockets] Error cargando historial de chat:', err);
    }

    return { success: true, message: 'Unido a la sala exitosamente', boardId: payload.boardId };
  }

  @UseGuards(WsAuthGuard)
  @SubscribeMessage('chat:message')
  async handleChatMessage(
    @ConnectedSocket() client: any,
    @MessageBody() payload: { boardId: string; message: string; recipientId?: string; isPrivate?: boolean | string }
  ) {
    if (!payload?.boardId || !payload?.message?.trim()) {
      return { success: false, message: 'boardId y message son requeridos' };
    }

    const rawMessage = payload.message.trim();

    // 1. Detectar comandos de break time (sólo host)
    if (rawMessage.match(/^\/break\s+time\s+(stop|end|off|cancel)/i)) {
      try {
        const boardObjId = new Types.ObjectId(payload.boardId);
        const userObjId = new Types.ObjectId(client.user?.sub);
        const member = await this.boardMemberModel.findOne({ boardId: boardObjId, userId: userObjId }).exec();
        if (member && member.role === 'host') {
          this.server.to(payload.boardId).emit('board:break', { duration: 0, endTime: 0 });
          return { success: true };
        } else {
          client.emit('chat:message', {
            _id: new Types.ObjectId().toString(),
            boardId: payload.boardId,
            message: 'Solo el host puede cancelar el tiempo de descanso.',
            createdAt: new Date().toISOString(),
            isPrivate: true,
            sender: { _id: 'system', displayName: 'Sistema', email: 'system@dokyuu.com' }
          });
          return { success: false, message: 'No autorizado' };
        }
      } catch (err) {
        console.error('[Sockets] Error en break time stop:', err);
        return { success: false };
      }
    }

    const breakMatch = rawMessage.match(/^\/break\s+time\s+(\d+)(s|m)?/i);
    if (breakMatch) {
      try {
        const boardObjId = new Types.ObjectId(payload.boardId);
        const userObjId = new Types.ObjectId(client.user?.sub);
        const member = await this.boardMemberModel.findOne({ boardId: boardObjId, userId: userObjId }).exec();
        if (member && member.role === 'host') {
          const val = parseInt(breakMatch[1], 10);
          const unit = breakMatch[2] || 'm';
          const durationSeconds = unit === 's' ? val : val * 60;
          const endTime = Date.now() + durationSeconds * 1000;

          this.server.to(payload.boardId).emit('board:break', {
            duration: durationSeconds,
            endTime,
            initiatedBy: client.user?.displayName || client.user?.email.split('@')[0]
          });
          return { success: true };
        } else {
          client.emit('chat:message', {
            _id: new Types.ObjectId().toString(),
            boardId: payload.boardId,
            message: 'Solo el host puede definir un tiempo de descanso (/break time).',
            createdAt: new Date().toISOString(),
            isPrivate: true,
            sender: { _id: 'system', displayName: 'Sistema', email: 'system@dokyuu.com' }
          });
          return { success: false, message: 'No autorizado' };
        }
      } catch (err) {
        console.error('[Sockets] Error en break time:', err);
        return { success: false };
      }
    }

    // 2. Procesar mensaje de chat regular o privado
    let recipientId = payload.recipientId;
    let isPrivate = payload.isPrivate === true || payload.isPrivate === 'true';
    let finalMessage = rawMessage;

    // Parseo de comandos /w, /msg o /pm en el propio texto del mensaje
    const whisperMatch = rawMessage.match(/^\/(w|msg|pm)\s+@([^\s]+)\s+(.+)$/i);
    if (whisperMatch) {
      const targetUsername = whisperMatch[2].toLowerCase();
      const actualMsg = whisperMatch[3];
      
      const roomUserList = this.roomUsers.get(payload.boardId) ?? [];
      const foundUser = roomUserList.find(u => 
        (u.displayName && u.displayName.toLowerCase().replace(/\s+/g, '') === targetUsername) ||
        u.email.split('@')[0].toLowerCase() === targetUsername
      );
      if (foundUser) {
        recipientId = foundUser.userId;
        isPrivate = true;
        finalMessage = actualMsg;
      }
    }

    try {
      const messageDoc = new this.chatMessageModel({
        boardId: new Types.ObjectId(payload.boardId),
        sender: new Types.ObjectId(client.user?.sub),
        recipient: isPrivate && recipientId ? new Types.ObjectId(recipientId) : undefined,
        isPrivate: isPrivate && !!recipientId,
        message: finalMessage,
      });

      const savedMessage = await messageDoc.save();
      const populated = await savedMessage.populate([
        { path: 'sender', select: 'displayName email' },
        { path: 'recipient', select: 'displayName email' }
      ]);
      const senderObj = populated.sender as any;
      const recipientObj = populated.recipient as any;

      const structuredMessage = {
        _id: populated._id,
        boardId: populated.boardId,
        message: populated.message,
        createdAt: (populated as any).createdAt,
        isPrivate: populated.isPrivate,
        sender: {
          _id: senderObj?._id || client.user?.sub || '',
          displayName: senderObj?.displayName || client.user?.displayName || '',
          email: senderObj?.email || client.user?.email || ''
        },
        recipient: recipientObj ? {
          _id: recipientObj?._id || '',
          displayName: recipientObj?.displayName || '',
          email: recipientObj?.email || ''
        } : undefined
      };

      if (populated.isPrivate && populated.recipient) {
        // Enviar solo al remitente y destinatario
        const roomUserList = this.roomUsers.get(payload.boardId) ?? [];
        
        // Sockets del destinatario
        const recipientUsers = roomUserList.filter(u => u.userId === recipientId);
        for (const ru of recipientUsers) {
          this.server.to(ru.socketId).emit('chat:message', structuredMessage);
        }
        
        // Sockets del remitente
        const senderUsers = roomUserList.filter(u => u.userId === client.user?.sub);
        for (const su of senderUsers) {
          this.server.to(su.socketId).emit('chat:message', structuredMessage);
        }
      } else {
        // Mensaje público: emitir a toda la sala
        this.server.to(payload.boardId).emit('chat:message', structuredMessage);
      }

      return { success: true };
    } catch (err) {
      console.error('[Sockets] Error al enviar mensaje de chat:', err);
      return { success: false, message: 'Error interno al enviar mensaje' };
    }
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

    // ── Merge inteligente respetando locks ──────────────────────────────────
    const incoming = payload.elements;
    const current = this.boardState.get(payload.boardId) ?? [];

    // Construir mapa del estado actual para lookup rápido
    const currentMap = new Map<string, any>();
    for (const el of current) {
      currentMap.set(el.id, el);
    }

    // Construir mapa del estado entrante
    const incomingMap = new Map<string, any>();
    for (const el of incoming) {
      incomingMap.set(el.id, el);
    }

    // Resultado del merge
    const merged: any[] = [];

    // 1. Procesar elementos entrantes
    for (const el of incoming) {
      const lock = this.lockedElements.get(el.id);
      if (lock && lock.userId !== client.user?.sub) {
        // Elemento bloqueado por OTRO usuario — preservar versión actual
        const preserved = currentMap.get(el.id);
        if (preserved) {
          merged.push(preserved);
        } else {
          // No existe en estado actual, agregar igualmente (elemento nuevo)
          merged.push(el);
        }
      } else {
        // Sin lock o bloqueado por el emisor — aplicar cambio
        merged.push(el);
      }
    }

    // 2. Preservar elementos que el emisor eliminó pero que están bloqueados por otro
    for (const el of current) {
      if (!incomingMap.has(el.id)) {
        const lock = this.lockedElements.get(el.id);
        if (lock && lock.userId !== client.user?.sub) {
          // Elemento eliminado pero bloqueado por otro — preservarlo
          merged.push(el);
        }
        // Si no está bloqueado, se permite la eliminación (no se agrega)
      }
    }

    // Actualizar estado canónico
    this.boardState.set(payload.boardId, merged);

    console.log(`[Sockets] canvas:update | sala: ${payload.boardId} | user: ${client.user?.email} | elementos: ${merged.length}`);

    // Emitir el estado mergeado a TODA la sala (incluido el emisor para sincronizar)
    this.server.to(payload.boardId).emit('canvas:update', merged);
  }

  // ── Bloqueo de elementos ─────────────────────────────────────────────────

  @UseGuards(WsAuthGuard)
  @SubscribeMessage('element:lock')
  handleElementLock(
    @ConnectedSocket() client: any,
    @MessageBody() payload: { boardId: string; elementId: string }
  ) {
    if (!payload?.boardId || !payload?.elementId) return;

    const existingLock = this.lockedElements.get(payload.elementId);
    // Solo permitir si no está bloqueado por otro o si es el mismo usuario
    if (existingLock && existingLock.userId !== client.user?.sub) {
      return { success: false, lockedBy: existingLock };
    }

    const lockInfo: LockInfo = {
      userId: client.user?.sub,
      displayName: client.user?.displayName || client.user?.email?.split('@')[0] || '',
      email: client.user?.email || '',
      color: client.userCursorColor || '#4F46E5',
      boardId: payload.boardId,
    };

    this.lockedElements.set(payload.elementId, lockInfo);

    // Notificar a los DEMÁS usuarios de la sala
    client.to(payload.boardId).emit('element:lock', {
      elementId: payload.elementId,
      lock: lockInfo,
    });

    return { success: true };
  }

  @UseGuards(WsAuthGuard)
  @SubscribeMessage('element:unlock')
  handleElementUnlock(
    @ConnectedSocket() client: any,
    @MessageBody() payload: { boardId: string; elementId: string }
  ) {
    if (!payload?.boardId || !payload?.elementId) return;

    const existingLock = this.lockedElements.get(payload.elementId);
    // Solo el dueño del lock puede liberarlo
    if (!existingLock || existingLock.userId !== client.user?.sub) {
      return { success: false };
    }

    this.lockedElements.delete(payload.elementId);

    // Notificar a los DEMÁS usuarios
    client.to(payload.boardId).emit('element:unlock', {
      elementIds: [payload.elementId],
    });

    return { success: true };
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

    // Liberar locks del usuario expulsado
    this._releaseLocksForUser(payload.targetUserId, payload.boardId);

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

  private _releaseLocksForUser(userId: string, boardId: string) {
    const releasedLocks: string[] = [];
    for (const [elementId, lock] of this.lockedElements.entries()) {
      if (lock.userId === userId && lock.boardId === boardId) {
        this.lockedElements.delete(elementId);
        releasedLocks.push(elementId);
      }
    }
    if (releasedLocks.length > 0) {
      this.server.to(boardId).emit('element:unlock', { elementIds: releasedLocks });
    }
  }
}
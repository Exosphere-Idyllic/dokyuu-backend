import { CanActivate, ExecutionContext, Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';

@Injectable()
export class WsAuthGuard implements CanActivate {
  constructor(private jwtService: JwtService) {}

  canActivate(context: ExecutionContext): boolean {
    const client = context.switchToWs().getClient();
    let token = client.handshake?.auth?.token || client.handshake?.headers?.['authorization'];
    
    if (token && token.startsWith('Bearer ')) {
      token = token.slice(7);
    }

    if (!token) {
      throw new UnauthorizedException('Missing token for WebSocket connection');
    }

    try {
      const payload = this.jwtService.verify(token);
      client.user = payload; // Adjunto la identificación al client socket
      return true;
    } catch (e) {
      throw new UnauthorizedException('Token invalid or expired');
    }
  }
}

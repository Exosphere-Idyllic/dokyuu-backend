import { Test, TestingModule } from '@nestjs/testing';
import { getModelToken } from '@nestjs/mongoose';
import { JwtService } from '@nestjs/jwt';
import { SocketGateway } from './socket.gateway';
import { WsAuthGuard } from '../auth/ws-auth.guard';
import { WsRoleGuard } from './ws-role.guard';
import { ChatMessage } from '../schemas/chat-message.schema';
import { BoardMember } from '../schemas/board-member.schema';

describe('SocketGateway', () => {
  let gateway: SocketGateway;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        SocketGateway,
        WsAuthGuard,
        WsRoleGuard,
        {
          provide: getModelToken(ChatMessage.name),
          useValue: {
            find: jest.fn().mockReturnThis(),
            sort: jest.fn().mockReturnThis(),
            limit: jest.fn().mockReturnThis(),
            populate: jest.fn().mockReturnThis(),
            exec: jest.fn().mockResolvedValue([]),
          },
        },
        {
          provide: getModelToken(BoardMember.name),
          useValue: {
            findOne: jest.fn().mockReturnThis(),
            exec: jest.fn().mockResolvedValue(null),
          },
        },
        {
          provide: JwtService,
          useValue: {
            verify: jest.fn(),
            sign: jest.fn(),
          },
        },
      ],
    }).compile();

    gateway = module.get<SocketGateway>(SocketGateway);
  });

  it('should be defined', () => {
    expect(gateway).toBeDefined();
  });
});

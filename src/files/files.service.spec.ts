import { Test, TestingModule } from '@nestjs/testing';
import { FilesService } from './files.service';
import { getModelToken } from '@nestjs/mongoose';
import { UploadedImage } from '../schemas/uploaded-image.schema';
import { BoardMember } from '../schemas/board-member.schema';
import { ForbiddenException } from '@nestjs/common';
import { Types } from 'mongoose';

describe('FilesService', () => {
  let service: FilesService;
  let mockUploadedImageModel: any;
  let mockBoardMemberModel: any;

  beforeEach(async () => {
    mockUploadedImageModel = {
      find: jest.fn().mockReturnThis(),
      sort: jest.fn().mockReturnThis(),
      exec: jest.fn(),
      save: jest.fn(),
    };

    mockBoardMemberModel = {
      findOne: jest.fn().mockReturnThis(),
      exec: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        FilesService,
        {
          provide: getModelToken(UploadedImage.name),
          useValue: mockUploadedImageModel,
        },
        {
          provide: getModelToken(BoardMember.name),
          useValue: mockBoardMemberModel,
        },
      ],
    }).compile();

    service = module.get<FilesService>(FilesService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('getImageHistory', () => {
    const userId = new Types.ObjectId().toString();
    const boardId = new Types.ObjectId().toString();

    it('should throw ForbiddenException if user is not a member of the board', async () => {
      mockBoardMemberModel.findOne.mockReturnThis();
      mockBoardMemberModel.exec.mockResolvedValue(null);

      await expect(service.getImageHistory(userId, boardId)).rejects.toThrow(ForbiddenException);
    });

    it('should return personal and board images', async () => {
      mockBoardMemberModel.findOne.mockReturnThis();
      mockBoardMemberModel.exec.mockResolvedValue({ userId, boardId, role: 'member' });

      const personalImage = {
        _id: new Types.ObjectId(),
        url: 'http://personal.jpg',
        publicId: 'p1',
        width: 100,
        height: 100,
        createdAt: new Date(),
      };

      const boardImage = {
        _id: new Types.ObjectId(),
        url: 'http://board.jpg',
        publicId: 'b1',
        width: 200,
        height: 200,
        createdAt: new Date(),
      };

      mockUploadedImageModel.find
        .mockImplementationOnce(() => ({
          sort: () => ({
            exec: () => Promise.resolve([personalImage]),
          }),
        }))
        .mockImplementationOnce(() => ({
          sort: () => ({
            exec: () => Promise.resolve([boardImage]),
          }),
        }));

      const result = await service.getImageHistory(userId, boardId);

      expect(result).toEqual({
        personal: [
          {
            id: personalImage._id.toString(),
            url: personalImage.url,
            publicId: personalImage.publicId,
            width: personalImage.width,
            height: personalImage.height,
            createdAt: personalImage.createdAt,
          },
        ],
        board: [
          {
            id: boardImage._id.toString(),
            url: boardImage.url,
            publicId: boardImage.publicId,
            width: boardImage.width,
            height: boardImage.height,
            createdAt: boardImage.createdAt,
          },
        ],
      });
    });
  });
});

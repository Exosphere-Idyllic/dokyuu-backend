import { Controller, Get, Post, Put, Body, Param, UseGuards, Request } from '@nestjs/common';
import { BoardsService } from './boards.service';
import { CreateBoardDto } from './dto/create-board.dto';
import { UpdateBoardDto } from './dto/update-board.dto';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';

@UseGuards(JwtAuthGuard)
@Controller('boards')
export class BoardsController {
  constructor(private readonly boardsService: BoardsService) {}

  @Post()
  async create(@Request() req, @Body() createBoardDto: CreateBoardDto) {
    return this.boardsService.create(req.user._id, createBoardDto);
  }

  @Get()
  async findAll(@Request() req) {
    return this.boardsService.findAllForUser(req.user._id);
  }

  @Put(':id')
  async update(
    @Request() req,
    @Param('id') id: string,
    @Body() updateBoardDto: UpdateBoardDto,
  ) {
    return this.boardsService.update(id, req.user._id, updateBoardDto);
  }
}

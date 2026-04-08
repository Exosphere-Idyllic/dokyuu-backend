import { Controller, Post, Body, UseGuards, Request } from '@nestjs/common';
import { MembersService } from './members.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';

@UseGuards(JwtAuthGuard)
@Controller('members')
export class MembersController {
  constructor(private readonly membersService: MembersService) {}

  @Post('join')
  async joinBoard(@Request() req, @Body('code') code: string) {
    return this.membersService.joinBoardByCode(req.user._id, code);
  }
}

import { Controller, Get, Post, Put, Delete, Body, Param, UseGuards, Request, Patch } from '@nestjs/common';
import { TasksService } from './tasks.service';
import { CreateTaskDto } from './dto/create-task.dto';
import { UpdateTaskDto } from './dto/update-task.dto';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';

@UseGuards(JwtAuthGuard)
@Controller('tasks')
export class TasksController {
  constructor(private readonly tasksService: TasksService) {}

  @Post('board/:boardId')
  async create(
    @Request() req,
    @Param('boardId') boardId: string,
    @Body() createTaskDto: CreateTaskDto,
  ) {
    return this.tasksService.createForBoard(req.user._id, boardId, createTaskDto);
  }

  @Get('board/:boardId')
  async findAllForBoard(@Request() req, @Param('boardId') boardId: string) {
    return this.tasksService.findAllForBoard(boardId, req.user._id);
  }

  @Get('my/:boardId')
  async findMyTasks(@Request() req, @Param('boardId') boardId: string) {
    return this.tasksService.findMyTasksInBoard(req.user._id, boardId);
  }

  @Patch(':id/complete')
  async complete(@Request() req, @Param('id') id: string) {
    return this.tasksService.completeTask(id, req.user._id);
  }

  @Patch(':id/elements')
  async addElement(
    @Request() req,
    @Param('id') id: string,
    @Body('elementId') elementId: string,
  ) {
    return this.tasksService.addElementToTask(id, elementId, req.user._id);
  }

  @Put(':id')
  async update(
    @Request() req,
    @Param('id') id: string,
    @Body() updateTaskDto: UpdateTaskDto,
  ) {
    return this.tasksService.update(id, req.user._id, updateTaskDto);
  }

  @Delete(':id')
  async remove(@Request() req, @Param('id') id: string) {
    return this.tasksService.remove(id, req.user._id);
  }
}

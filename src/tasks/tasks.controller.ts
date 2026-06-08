import { Controller, Get, Post, Put, Delete, Body, Param, UseGuards, Request } from '@nestjs/common';
import { TasksService } from './tasks.service';
import { CreateTaskDto } from './dto/create-task.dto';
import { UpdateTaskDto } from './dto/update-task.dto';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';

@UseGuards(JwtAuthGuard)
@Controller('tasks')
export class TareaController {
  constructor(private readonly tasksService: TasksService) { }

  @Post()
  async create(@Request() req, @Body() createTaskDto: CreateTaskDto) {
    return this.tasksService.create(req.user._id, createTaskDto);
  }

  @Get()
  async findAll(@Request() req) {
    return this.tasksService.findAllForUser(req.user._id);
  }

  @Get(':id')
  async findOne(@Request() req, @Param('id') id: string) {
    return this.tasksService.findOne(id, req.user._id);
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

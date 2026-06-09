import { Injectable, NotFoundException, ForbiddenException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { Task } from '../schemas/task.schema';
import { BoardMember } from '../schemas/board-member.schema';
import { CreateTaskDto } from './dto/create-task.dto';
import { UpdateTaskDto } from './dto/update-task.dto';

@Injectable()
export class TasksService {
  constructor(
    @InjectModel(Task.name) private readonly taskModel: Model<Task>,
    @InjectModel(BoardMember.name) private readonly boardMemberModel: Model<BoardMember>,
  ) {}

  private async checkIsHost(userId: string | Types.ObjectId, boardId: string | Types.ObjectId): Promise<void> {
    const member = await this.boardMemberModel.findOne({
      boardId: new Types.ObjectId(boardId.toString()),
      userId: new Types.ObjectId(userId.toString()),
    }).exec();

    if (!member || member.role !== 'host') {
      throw new ForbiddenException('Solo el administrador de la pizarra puede realizar esta acción');
    }
  }

  async createForBoard(
    hostId: string | Types.ObjectId,
    boardId: string,
    createTaskDto: CreateTaskDto,
  ): Promise<Task> {
    await this.checkIsHost(hostId, boardId);

    const newTask = new this.taskModel({
      ...createTaskDto,
      boardId: new Types.ObjectId(boardId),
      assignedTo: new Types.ObjectId(createTaskDto.assignedTo),
      assignedBy: new Types.ObjectId(hostId.toString()),
      status: 'active',
      elementIds: [],
    });
    const saved = await newTask.save();
    return saved.populate('assignedTo', 'displayName email');
  }

  async findAllForBoard(boardId: string, hostId: string | Types.ObjectId): Promise<Task[]> {
    await this.checkIsHost(hostId, boardId);
    return await this.taskModel.find({ boardId: new Types.ObjectId(boardId) })
      .populate('assignedTo', 'displayName email')
      .exec();
  }

  async findMyTasksInBoard(userId: string | Types.ObjectId, boardId: string): Promise<Task[]> {
    return await this.taskModel.find({
      boardId: new Types.ObjectId(boardId),
      assignedTo: new Types.ObjectId(userId.toString()),
    })
      .populate('assignedTo', 'displayName email')
      .exec();
  }

  async addElementToTask(
    taskId: string,
    elementId: string,
    hostId: string | Types.ObjectId,
  ): Promise<Task> {
    const task = await this.taskModel.findById(taskId).exec();
    if (!task) {
      throw new NotFoundException('Tarea no encontrada');
    }
    await this.checkIsHost(hostId, task.boardId);

    if (!task.elementIds.includes(elementId)) {
      task.elementIds.push(elementId);
      await task.save();
    }
    return task;
  }

  async completeTask(taskId: string, userId: string | Types.ObjectId): Promise<Task> {
    const task = await this.taskModel.findById(taskId).exec();
    if (!task) {
      throw new NotFoundException('Tarea no encontrada');
    }

    // El host o el propio asignado pueden completar la tarea
    const isAssignee = task.assignedTo.toString() === userId.toString();
    let isHost = false;
    try {
      await this.checkIsHost(userId, task.boardId);
      isHost = true;
    } catch (e) {
      isHost = false;
    }

    if (!isAssignee && !isHost) {
      throw new ForbiddenException('No tienes permiso para completar esta tarea');
    }

    task.status = 'completed';
    task.completedAt = new Date();
    return await task.save();
  }

  async update(
    id: string,
    hostId: string | Types.ObjectId,
    updateTaskDto: UpdateTaskDto,
  ): Promise<Task> {
    const task = await this.taskModel.findById(id).exec();
    if (!task) {
      throw new NotFoundException('Tarea no encontrada');
    }
    await this.checkIsHost(hostId, task.boardId);

    const updated = await this.taskModel.findByIdAndUpdate(
      id,
      { $set: updateTaskDto },
      { new: true },
    ).populate('assignedTo', 'displayName email').exec();

    if (!updated) {
      throw new NotFoundException('Tarea no encontrada');
    }
    return updated;
  }

  async remove(id: string, hostId: string | Types.ObjectId): Promise<{ success: boolean }> {
    const task = await this.taskModel.findById(id).exec();
    if (!task) {
      throw new NotFoundException('Tarea no encontrada');
    }
    await this.checkIsHost(hostId, task.boardId);

    await this.taskModel.deleteOne({ _id: id }).exec();
    return { success: true };
  }
}

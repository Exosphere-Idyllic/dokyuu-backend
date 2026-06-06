import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { Task } from '../models/task.model';
import { CreateTaskDto } from './dto/create-task.dto';
import { UpdateTaskDto } from './dto/update-task.dto';

@Injectable()
export class TasksService {
  constructor(
    @InjectModel(Task.name) private readonly taskModel: Model<Task>,
  ) {}

  async create(userId: string | Types.ObjectId, createTaskDto: CreateTaskDto): Promise<Task> {
    const newTask = new this.taskModel({
      ...createTaskDto,
      user: userId,
    });
    return await newTask.save();
  }

  async findAllForUser(userId: string | Types.ObjectId): Promise<Task[]> {
    return await this.taskModel.find({ user: userId }).exec();
  }

  async findOne(id: string, userId: string | Types.ObjectId): Promise<Task> {
    const task = await this.taskModel.findOne({ _id: id, user: userId }).exec();
    if (!task) {
      throw new NotFoundException('Tarea no encontrada o no tienes permiso para acceder a ella');
    }
    return task;
  }

  async update(
    id: string,
    userId: string | Types.ObjectId,
    updateTaskDto: UpdateTaskDto,
  ): Promise<Task> {
    const task = await this.taskModel.findOneAndUpdate(
      { _id: id, user: userId },
      { $set: updateTaskDto },
      { new: true },
    ).exec();

    if (!task) {
      throw new NotFoundException('Tarea no encontrada o no tienes permiso para modificarla');
    }
    return task;
  }

  async remove(id: string, userId: string | Types.ObjectId): Promise<{ success: boolean }> {
    const result = await this.taskModel.deleteOne({ _id: id, user: userId }).exec();
    if (result.deletedCount === 0) {
      throw new NotFoundException('Tarea no encontrada o no tienes permiso para eliminarla');
    }
    return { success: true };
  }
}

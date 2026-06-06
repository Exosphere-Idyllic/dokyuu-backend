import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { TasksService } from './tasks.service';
import { TareaController } from '../controllers/tareaController';
import { Task, TaskSchema } from '../models/task.model';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: Task.name, schema: TaskSchema },
    ]),
  ],
  providers: [TasksService],
  controllers: [TareaController],
  exports: [TasksService],
})
export class TasksModule {}

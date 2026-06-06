import { IsOptional, IsString, IsDateString, IsIn } from 'class-validator';

export class UpdateTaskDto {
  @IsString()
  @IsOptional()
  title?: string;

  @IsString()
  @IsOptional()
  description?: string;

  @IsString()
  @IsOptional()
  @IsIn(['pending', 'in-progress', 'completed'], {
    message: 'El estado debe ser pending, in-progress o completed',
  })
  status?: string;

  @IsDateString({}, { message: 'La fecha de vencimiento debe ser una fecha válida' })
  @IsOptional()
  dueDate?: string;
}

import { IsOptional, IsString, IsIn, IsArray } from 'class-validator';

export class UpdateTaskDto {
  @IsString()
  @IsOptional()
  title?: string;

  @IsString()
  @IsOptional()
  description?: string;

  @IsString()
  @IsOptional()
  @IsIn(['active', 'completed'], {
    message: 'El estado debe ser active o completed',
  })
  status?: string;

  @IsArray()
  @IsOptional()
  elementIds?: string[];
}

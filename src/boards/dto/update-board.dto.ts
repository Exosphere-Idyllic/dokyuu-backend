import { IsOptional, IsString, IsNotEmpty } from 'class-validator';

export class UpdateBoardDto {
  @IsString()
  @IsNotEmpty({ message: 'El nombre de la pizarra no puede estar vacío' })
  @IsOptional()
  name?: string;

  @IsString()
  @IsOptional()
  description?: string;
}

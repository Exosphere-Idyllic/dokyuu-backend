import { IsNotEmpty, IsOptional, IsString } from 'class-validator';

export class CreateBoardDto {
  @IsString()
  @IsNotEmpty({ message: 'El nombre de la pizarra es obligatorio' })
  name: string;

  @IsString()
  @IsOptional()
  description?: string;
}

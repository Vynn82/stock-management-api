import { IsNotEmpty, IsString, MaxLength } from 'class-validator';

export class CreateResourceDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(50)
  resource: string;
}

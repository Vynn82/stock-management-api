import { IsNotEmpty, IsString, MaxLength } from 'class-validator';

export class CreatePermissionDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(50)
  resource: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(50)
  action: string;
}

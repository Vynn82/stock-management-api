import { IsIn, IsNotEmpty, IsOptional, IsString, MaxLength } from 'class-validator';

export class RegisterDeviceDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(4096)
  token: string;

  @IsOptional()
  @IsIn(['android', 'ios'])
  platform?: string;
}

export class UnregisterDeviceDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(4096)
  token: string;
}

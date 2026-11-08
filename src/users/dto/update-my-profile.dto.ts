import { IsEmail, IsOptional, IsString, Length, MaxLength } from 'class-validator';

/** What a signed-in person may change about themselves. */
export class UpdateMyProfileDto {
  @IsOptional()
  @IsString()
  @Length(1, 200)
  fullName?: string;

  @IsOptional()
  @IsEmail()
  @MaxLength(255)
  email?: string;

  /** Send an empty string to clear it. */
  @IsOptional()
  @IsString()
  @MaxLength(30)
  phone?: string;
}

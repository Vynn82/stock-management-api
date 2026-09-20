import { IsEnum, IsOptional, IsString } from 'class-validator';

export enum CommitAction {
  APPROVE = 'APPROVE',
  REJECT = 'REJECT',
}

export class CommitRequestDto {
  @IsEnum(CommitAction)
  action: CommitAction;

  @IsOptional()
  @IsString()
  remark?: string;
}

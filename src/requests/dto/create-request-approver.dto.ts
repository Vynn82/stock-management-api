import { IsEnum, IsUUID } from 'class-validator';
import { ApproverActionType } from '../entities/approver.entity';

export class CreateRequestApproverDto {
  @IsUUID()
  userId: string;

  @IsEnum(ApproverActionType)
  actionType: ApproverActionType;
}

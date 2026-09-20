import { IsUUID } from 'class-validator';

export class AssignRoleMenuDto {
  @IsUUID()
  menuId: string;
}

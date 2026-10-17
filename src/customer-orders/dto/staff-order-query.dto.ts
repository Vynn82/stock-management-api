import { IsEnum, IsOptional, IsString, IsUUID } from 'class-validator';
import { PaginationDto } from '../../common/pagination';
import { CustomerOrderStatus } from '../enums/customer-order-status.enum';
import { DeliveryStatus, PaymentStatus } from '../enums/customer-order-enums';
import { OrderSource } from '../enums/order-source.enum';

export class StaffOrderQueryDto extends PaginationDto {
  @IsOptional()
  @IsEnum(CustomerOrderStatus)
  status?: CustomerOrderStatus;

  @IsOptional()
  @IsEnum(OrderSource)
  source?: OrderSource;

  @IsOptional()
  @IsEnum(DeliveryStatus)
  deliveryStatus?: DeliveryStatus;

  @IsOptional()
  @IsEnum(PaymentStatus)
  paymentStatus?: PaymentStatus;

  @IsOptional()
  @IsUUID()
  customerId?: string;

  @IsOptional()
  @IsString()
  dateFrom?: string;

  @IsOptional()
  @IsString()
  dateTo?: string;
}

import {
  Body,
  Controller,
  Get,
  Param,
  Post,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import { CustomerOrdersService } from './customer-orders.service';
import { TelegramAuthService } from './telegram/telegram-auth.service';
import { CustomerJwtGuard } from './guards/customer-jwt.guard';
import { Public } from '../auth/decorators/public.decorator';
import { CreateCustomerOrderDto } from './dto/create-customer-order.dto';
import {
  AskCustomerDto,
  ConfirmQuantityDto,
  CustomerResponseDto,
  CustomerResponseType,
  RecordPaymentDto,
  RejectOrderDto,
} from './dto/customer-order-actions.dto';
import {
  CustomerQueryDto,
  RejectCustomerRegistrationDto,
} from './dto/customer-registration.dto';
import { CreateStaffCustomerOrderDto } from './dto/create-staff-customer-order.dto';
import { StaffOrderQueryDto } from './dto/staff-order-query.dto';
import * as authenticatedUserInterface from '../auth/interfaces/authenticated-request.interface';

@Controller('customer-orders')
export class CustomerOrdersController {
  constructor(
    private readonly customerOrdersService: CustomerOrdersService,
    private readonly telegramAuthService: TelegramAuthService,
  ) {}

  // ========================================================
  // 1. CUSTOMER MINI APP ORDER ROUTES
  // ========================================================

  @Public()
  @UseGuards(CustomerJwtGuard)
  @Post()
  async createOrder(@Req() req: any, @Body() dto: CreateCustomerOrderDto) {
    return this.customerOrdersService.createOrder(req.customer.id, dto);
  }

  @Public()
  @UseGuards(CustomerJwtGuard)
  @Get('my-orders')
  async getMyOrders(@Req() req: any, @Query() query: StaffOrderQueryDto) {
    return this.customerOrdersService.getMyOrders(req.customer.id, query);
  }

  @Public()
  @UseGuards(CustomerJwtGuard)
  @Get('my-orders/:id')
  async getMyOrderById(@Req() req: any, @Param('id') id: string) {
    return this.customerOrdersService.getCustomerOrderById(id, req.customer.id);
  }

  @Public()
  @UseGuards(CustomerJwtGuard)
  @Post(':id/customer-response')
  async customerResponse(
    @Req() req: any,
    @Param('id') id: string,
    @Body() dto: CustomerResponseDto,
  ) {
    return this.customerOrdersService.handleCustomerResponse(
      id,
      req.customer.id,
      dto,
    );
  }

  @Public()
  @UseGuards(CustomerJwtGuard)
  @Post(':id/cancel')
  async customerCancelOrder(@Req() req: any, @Param('id') id: string) {
    return this.customerOrdersService.handleCustomerResponse(
      id,
      req.customer.id,
      {
        responseType: CustomerResponseType.REJECT,
        message: 'Order cancelled by customer',
      },
    );
  }

  // ========================================================
  // 2. STAFF / ADMIN CUSTOMER REGISTRATION APPROVAL ROUTES
  // ========================================================

  @Get('customers/search')
  async searchCustomers(
    @Query('query') query?: string,
    @Query('q') q?: string,
  ) {
    return this.telegramAuthService.searchCustomersForStaff(query || q || '');
  }

  @Get('customers')
  async findAllCustomers(@Query() query: CustomerQueryDto) {
    return this.telegramAuthService.findAllCustomersForStaff(query);
  }

  @Post('customers/:id/approve')
  async approveCustomer(
    @Param('id') id: string,
    @Req() req: authenticatedUserInterface.AuthenticatedRequest,
  ) {
    return this.telegramAuthService.approveCustomer(id, req.user.sub);
  }

  @Post('customers/:id/reject')
  async rejectCustomer(
    @Param('id') id: string,
    @Req() req: authenticatedUserInterface.AuthenticatedRequest,
    @Body() dto: RejectCustomerRegistrationDto,
  ) {
    return this.telegramAuthService.rejectCustomer(
      id,
      req.user.sub,
      dto.reason,
    );
  }

  // ========================================================
  // 3. STAFF / ADMIN ORDER MANAGEMENT ROUTES
  // ========================================================

  @Get('location/reverse-geocode')
  async reverseGeocode(
    @Query('lat') lat: number,
    @Query('lng') lng: number,
  ) {
    return this.telegramAuthService.reverseGeocode(Number(lat), Number(lng));
  }

  @Get('location/search')
  async searchLocation(@Query('query') query: string) {
    return this.telegramAuthService.searchLocation(query);
  }

  @Post('staff')
  async createOrderForStaff(
    @Req() req: authenticatedUserInterface.AuthenticatedRequest,
    @Body() dto: CreateStaffCustomerOrderDto,
  ) {
    return this.customerOrdersService.createOrderForStaff(req.user.sub, dto);
  }

  @Get()
  async findAllForStaff(@Query() query: StaffOrderQueryDto) {
    return this.customerOrdersService.findAllForStaff(query);
  }

  @Get(':id')
  async findOneForStaff(@Param('id') id: string) {
    return this.customerOrdersService.findOneForStaff(id);
  }

  @Post(':id/accept')
  async acceptOrder(
    @Param('id') id: string,
    @Req() req: authenticatedUserInterface.AuthenticatedRequest,
    @Body('warehouseCode') warehouseCode?: string,
  ) {
    return this.customerOrdersService.acceptOrder(
      id,
      req.user.sub,
      warehouseCode,
    );
  }

  @Post(':id/reject')
  async rejectOrder(
    @Param('id') id: string,
    @Req() req: authenticatedUserInterface.AuthenticatedRequest,
    @Body() dto?: RejectOrderDto,
  ) {
    return this.customerOrdersService.rejectOrder(id, req.user.sub, dto);
  }

  @Post(':id/ask-customer')
  async askCustomer(
    @Param('id') id: string,
    @Req() req: authenticatedUserInterface.AuthenticatedRequest,
    @Body() dto: AskCustomerDto,
  ) {
    return this.customerOrdersService.askCustomer(id, req.user.sub, dto);
  }

  @Post(':id/confirm-quantity')
  async confirmQuantity(
    @Param('id') id: string,
    @Req() req: authenticatedUserInterface.AuthenticatedRequest,
    @Body() dto: ConfirmQuantityDto,
  ) {
    return this.customerOrdersService.confirmCustomQuantities(
      id,
      req.user.sub,
      dto,
    );
  }

  @Post(':id/process')
  async processOrder(
    @Param('id') id: string,
    @Req() req: authenticatedUserInterface.AuthenticatedRequest,
  ) {
    return this.customerOrdersService.processOrder(id, req.user.sub);
  }

  @Post(':id/out-for-delivery')
  async outForDelivery(
    @Param('id') id: string,
    @Req() req: authenticatedUserInterface.AuthenticatedRequest,
  ) {
    return this.customerOrdersService.outForDelivery(id, req.user.sub);
  }

  @Post(':id/delivered')
  async markDelivered(
    @Param('id') id: string,
    @Req() req: authenticatedUserInterface.AuthenticatedRequest,
  ) {
    return this.customerOrdersService.markDelivered(id, req.user.sub);
  }

  @Post(':id/payment')
  async recordPayment(
    @Param('id') id: string,
    @Req() req: authenticatedUserInterface.AuthenticatedRequest,
    @Body() dto: RecordPaymentDto,
  ) {
    return this.customerOrdersService.recordCashPayment(id, req.user.sub, dto);
  }

  @Post(':id/complete')
  async completeOrder(
    @Param('id') id: string,
    @Req() req: authenticatedUserInterface.AuthenticatedRequest,
  ) {
    return this.customerOrdersService.completeOrder(id, req.user.sub);
  }
}

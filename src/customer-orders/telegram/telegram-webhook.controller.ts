import {
  Body,
  Controller,
  HttpCode,
  HttpStatus,
  Logger,
  Post,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Public } from '../../auth/decorators/public.decorator';
import { CustomerOrdersService } from '../customer-orders.service';
import { TelegramBotService } from './telegram-bot.service';
import { Customer } from '../entities/customer.entity';
import { CustomerTelegramAccount } from '../entities/customer-telegram-account.entity';
import { CustomerOrder } from '../entities/customer-order.entity';
import { CustomerOrderStatus } from '../enums/customer-order-status.enum';
import { CustomerResponseType } from '../dto/customer-order-actions.dto';

@Controller('telegram')
export class TelegramWebhookController {
  private readonly logger = new Logger(TelegramWebhookController.name);

  constructor(
    private readonly customerOrdersService: CustomerOrdersService,
    private readonly telegramBotService: TelegramBotService,
    @InjectRepository(Customer)
    private readonly customerRepo: Repository<Customer>,
    @InjectRepository(CustomerTelegramAccount)
    private readonly accountRepo: Repository<CustomerTelegramAccount>,
    @InjectRepository(CustomerOrder)
    private readonly orderRepo: Repository<CustomerOrder>,
  ) {}

  @Public()
  @Post('webhook')
  @HttpCode(HttpStatus.OK)
  async handleWebhook(@Body() update: any) {
    this.logger.log(
      `Received Telegram webhook update ID: ${update?.update_id}`,
    );

    try {
      // 1. Handle Inline Keyboard Callback Queries (e.g. Accept Qty / Cancel button clicks)
      if (update.callback_query) {
        await this.handleCallbackQuery(update.callback_query);
        return { ok: true };
      }

      // 2. Handle Text Messages (e.g. /start or customer free-text responses)
      if (update.message) {
        await this.handleIncomingMessage(update.message);
        return { ok: true };
      }
    } catch (err: any) {
      this.logger.error(
        `Error processing Telegram webhook: ${err.message}`,
        err.stack,
      );
    }

    return { ok: true };
  }

  private async handleCallbackQuery(callbackQuery: any) {
    const callbackId = callbackQuery.id;
    const from = callbackQuery.from;
    const data = callbackQuery.data as string;
    const chatId = callbackQuery.message?.chat?.id;

    if (!from || !data) {
      await this.telegramBotService.answerCallbackQuery(callbackId);
      return;
    }

    const telegramUserId = String(from.id);
    const account = await this.accountRepo.findOne({
      where: { telegramUserId },
      relations: { customer: true },
    });

    const customer = account?.customer;

    if (!customer) {
      await this.telegramBotService.answerCallbackQuery(
        callbackId,
        'Please register your account first in the Mini App.',
      );
      return;
    }

    // Acknowledge the callback query so the loading spinner stops in Telegram
    await this.telegramBotService.answerCallbackQuery(
      callbackId,
      'Processing your choice...',
    );

    if (data.startsWith('ACCEPT_QTY:')) {
      const parts = data.split(':');
      const orderId = parts[1];
      const proposedQty = Number(parts[2]);
      const itemId = parts[3] || undefined;

      await this.customerOrdersService.handleCustomerResponse(
        orderId,
        customer.id,
        {
          responseType: CustomerResponseType.ACCEPT,
          acceptedQuantity: proposedQty,
          itemId,
          message: `Accepted available quantity of ${proposedQty}`,
        },
      );
    } else if (data.startsWith('WAIT_ALL:')) {
      const parts = data.split(':');
      const orderId = parts[1];
      const totalQty = Number(parts[2]);
      const itemId = parts[3] || undefined;

      await this.customerOrdersService.handleCustomerResponse(
        orderId,
        customer.id,
        {
          responseType: CustomerResponseType.WAIT_STOCK,
          acceptedQuantity: 0,
          itemId,
          message: `Chose to wait for all ${totalQty} units`,
        },
      );
    } else if (data.startsWith('ACCEPT_ORDER:')) {
      const parts = data.split(':');
      const orderId = parts[1];

      await this.customerOrdersService.handleCustomerResponse(
        orderId,
        customer.id,
        {
          responseType: CustomerResponseType.ACCEPT,
          message: 'Confirmed and accepted',
        },
      );
    } else if (data.startsWith('CANCEL_ORDER:')) {
      const parts = data.split(':');
      const orderId = parts[1];

      await this.customerOrdersService.handleCustomerResponse(
        orderId,
        customer.id,
        {
          responseType: CustomerResponseType.REJECT,
          message: 'Order cancelled by customer via Telegram button',
        },
      );
    }
  }

  private async handleIncomingMessage(message: any) {
    const chatId = message.chat?.id;
    const text = message.text?.trim() || '';
    const from = message.from;

    if (!chatId || !from) return;

    // Handle /start command immediately
    if (text === '/start' || text.startsWith('/start ')) {
      await this.telegramBotService.sendWelcomeMenu(
        chatId,
        from.first_name || 'Partner',
      );
      return;
    }

    const telegramUserId = String(from.id);
    const account = await this.accountRepo.findOne({
      where: { telegramUserId },
      relations: { customer: true },
    });

    const customer = account?.customer;

    if (!customer) {
      // Customer has not registered yet
      await this.telegramBotService.sendMessage(
        chatId,
        `👋 Hello <b>${from.first_name || 'there'}</b>!\n\n` +
          `Welcome to the <b>Stock Management Partner Store</b>.\n` +
          `Tap below to open the Mini App and complete your partner registration:`,
        [
          [
            {
              text: '🛍️ Open Partner Store',
              web_app: { url: this.telegramBotService['getMiniAppUrl']() },
            },
          ],
        ],
      );
      return;
    }

    if (account && account.telegramChatId !== String(chatId)) {
      account.telegramChatId = String(chatId);
      await this.accountRepo.save(account);
    }

    // Customer sent free-text message:
    // Find customer's active order in WAITING_CUSTOMER or PENDING_REVIEW status
    const activeOrder = await this.orderRepo.findOne({
      where: [
        {
          customerId: customer.id,
          status: CustomerOrderStatus.WAITING_CUSTOMER,
        },
        {
          customerId: customer.id,
          status: CustomerOrderStatus.PENDING_REVIEW,
        },
      ],
      order: { createdAt: 'DESC' },
    });

    if (activeOrder) {
      // Pass message to handleCustomerResponse (Rule 16: Free-text never modifies stock directly)
      await this.customerOrdersService.handleCustomerResponse(
        activeOrder.id,
        customer.id,
        {
          responseType: CustomerResponseType.MESSAGE,
          message: text,
        },
      );
    } else {
      // General inquiry / conversation when no active order is awaiting response
      await this.telegramBotService.sendMessage(
        chatId,
        `👋 Hello <b>${customer.contactName || customer.companyName || from.first_name}</b>!\n\n` +
          `Thank you for messaging us. Tap below to browse our live inventory and place an order:`,
        [
          [
            {
              text: '🛍️ Open Partner Store',
              web_app: { url: this.telegramBotService['getMiniAppUrl']() },
            },
          ],
        ],
      );
    }
  }
}

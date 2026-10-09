import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

export interface TelegramInlineButton {
  text: string;
  callback_data?: string;
  url?: string;
  web_app?: { url: string };
}

@Injectable()
export class TelegramBotService {
  private readonly logger = new Logger(TelegramBotService.name);

  constructor(private readonly configService: ConfigService) {}

  private getBotToken(): string {
    const rawToken = this.configService.get<string>('TELEGRAM_BOT_TOKEN') || '';
    return rawToken.replace(/^["']|["']$/g, '').trim();
  }

  private getMiniAppUrl(): string {
    const url =
      this.configService.get<string>('TELEGRAM_MINI_APP_URL') ||
      'http://localhost:3001';
    return url.replace(/\/$/, '');
  }

  /**
   * Sends a message to a Telegram chat with optional HTML formatting and inline buttons.
   */
  async sendMessage(
    chatId: string | number,
    text: string,
    inlineKeyboard?: TelegramInlineButton[][],
  ): Promise<boolean> {
    const botToken = this.getBotToken();
    if (!botToken || !chatId) {
      this.logger.debug(
        `Telegram notification skipped (botToken or chatId empty). ChatId: ${chatId}`,
      );
      return false;
    }

    const url = `https://api.telegram.org/bot${botToken}/sendMessage`;
    const payload: Record<string, any> = {
      chat_id: chatId,
      text,
      parse_mode: 'HTML',
      disable_web_page_preview: true,
    };

    if (inlineKeyboard && inlineKeyboard.length > 0) {
      payload.reply_markup = {
        inline_keyboard: inlineKeyboard,
      };
    }

    try {
      const response = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      const data = await response.json();
      if (!response.ok || !data.ok) {
        this.logger.warn(
          `Telegram message delivery failed: ${data?.description}`,
        );
        return false;
      }
      return true;
    } catch (err: any) {
      this.logger.error(`Error sending Telegram message: ${err.message}`);
      return false;
    }
  }

  /**
   * Answers a Telegram callback query to clear loading spinner on buttons.
   */
  async answerCallbackQuery(
    callbackQueryId: string,
    text?: string,
  ): Promise<void> {
    const botToken = this.getBotToken();
    if (!botToken) return;

    try {
      await fetch(
        `https://api.telegram.org/bot${botToken}/answerCallbackQuery`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            callback_query_id: callbackQueryId,
            text: text || '',
            show_alert: false,
          }),
        },
      );
    } catch (err: any) {
      this.logger.error(`Failed to answer callback query: ${err.message}`);
    }
  }

  // ========================================================
  // NOTIFICATION TEMPLATES
  // ========================================================

  async notifyOrderCreated(
    chatId: string,
    orderNo: string,
    totalAmount: number,
  ): Promise<void> {
    const miniAppUrl = this.getMiniAppUrl();
    const text =
      `📦 <b>Order Received!</b>\n\n` +
      `Order: <b>#${orderNo}</b>\n` +
      `Total: <b>$${Number(totalAmount).toFixed(2)}</b>\n\n` +
      `We have received your order and staff are currently reviewing stock availability.\n` +
      `<i>Payment is cash on delivery.</i>`;

    await this.sendMessage(chatId, text, [
      [
        {
          text: '📱 View Order in Mini App',
          web_app: { url: `${miniAppUrl}/orders` },
        },
      ],
    ]);
  }

  async notifyStaffOrderCreated(
    chatId: string,
    orderNo: string,
    totalAmount: number,
    itemCount: number,
  ): Promise<void> {
    const miniAppUrl = this.getMiniAppUrl();
    const text =
      `📋 <b>New Order Created by Sales Staff</b>\n\n` +
      `Order: <b>#${orderNo}</b>\n` +
      `Items: <b>${itemCount} item(s)</b>\n` +
      `Total: <b>$${Number(totalAmount).toFixed(2)}</b>\n` +
      `Status: <b>Confirmed</b>\n\n` +
      `Your order has been placed by our sales representative and confirmed for delivery.\n` +
      `<i>Payment is cash on delivery.</i>`;

    await this.sendMessage(chatId, text, [
      [
        {
          text: '📱 View Order in Mini App',
          web_app: { url: `${miniAppUrl}/orders` },
        },
      ],
    ]);
  }

  async notifyStaffQuestion(
    chatId: string,
    orderId: string,
    orderNo: string,
    question: string,
    proposedQuantity?: number,
    requestedQuantity?: number,
    itemId?: string,
  ): Promise<void> {
    const text =
      `❓ <b>Question Regarding Your Order #${orderNo}</b>\n\n` +
      `${question}\n\n` +
      `Please tap an option below or type your response directly in this chat:`;

    const buttons: TelegramInlineButton[][] = [];

    if (proposedQuantity !== undefined && proposedQuantity > 0) {
      const availQty = proposedQuantity;
      const totalQty = requestedQuantity && requestedQuantity > availQty ? requestedQuantity : availQty;
      const itemSuffix = itemId ? `:${itemId}` : '';

      buttons.push([
        {
          text: `⚡ Get Available Now (${availQty})`,
          callback_data: `ACCEPT_QTY:${orderId}:${availQty}${itemSuffix}`,
        },
      ]);

      if (totalQty > availQty) {
        buttons.push([
          {
            text: `⏳ Wait for All (${totalQty})`,
            callback_data: `WAIT_ALL:${orderId}:${totalQty}${itemSuffix}`,
          },
        ]);
      }

      buttons.push([
        {
          text: '❌ Cancel',
          callback_data: `CANCEL_ORDER:${orderId}`,
        },
      ]);
    } else {
      buttons.push([
        {
          text: '✅ Confirm & Proceed',
          callback_data: `ACCEPT_ORDER:${orderId}`,
        },
      ]);
      buttons.push([
        {
          text: '❌ Cancel',
          callback_data: `CANCEL_ORDER:${orderId}`,
        },
      ]);
    }

    const miniAppUrl = this.getMiniAppUrl();
    buttons.push([
      {
        text: '📱 Open Order in Mini App',
        web_app: { url: `${miniAppUrl}/orders/${orderId}` },
      },
    ]);

    await this.sendMessage(chatId, text, buttons);
  }

  async notifyOrderConfirmed(chatId: string, orderNo: string): Promise<void> {
    const text =
      `✅ <b>Order Confirmed!</b>\n\n` +
      `Order <b>#${orderNo}</b> has been accepted by our staff and is scheduled for fulfillment.\n` +
      `Thank you for your business!`;

    await this.sendMessage(chatId, text);
  }

  async notifyStockAllocated(
    chatId: string,
    orderNo: string,
    productName: string,
    allocatedQty: number,
  ): Promise<void> {
    const text =
      `🎉 <b>Good News! Waiting Stock Is Available!</b>\n\n` +
      `New inventory has arrived for your order <b>#${orderNo}</b>.\n` +
      `Product: <b>${productName}</b>\n` +
      `Allocated: <b>+${allocatedQty} units</b>\n\n` +
      `Your order is now being processed for delivery.`;

    await this.sendMessage(chatId, text);
  }

  async notifyOrderProcessing(chatId: string, orderNo: string): Promise<void> {
    const text =
      `📦 <b>Order Being Prepared</b>\n\n` +
      `Order <b>#${orderNo}</b> is now being packed and prepared at our warehouse.`;

    await this.sendMessage(chatId, text);
  }

  async notifyOutForDelivery(
    chatId: string,
    orderNo: string,
    deliveryAddress?: string | null,
  ): Promise<void> {
    const addressStr = deliveryAddress
      ? `\nDestination: <i>${deliveryAddress}</i>`
      : '';
    const text =
      `🚚 <b>Order Out For Delivery!</b>\n\n` +
      `Order <b>#${orderNo}</b> is on its way to you.${addressStr}\n\n` +
      `💵 <i>Please prepare cash payment upon receipt.</i>`;

    await this.sendMessage(chatId, text);
  }

  async notifyOrderDelivered(
    chatId: string,
    orderNo: string,
    totalAmount: number,
  ): Promise<void> {
    const text =
      `📦 <b>Order Delivered!</b>\n\n` +
      `Order <b>#${orderNo}</b> has arrived.\n` +
      `Total Cash to Pay: <b>$${Number(totalAmount).toFixed(2)}</b>\n\n` +
      `Our delivery representative will collect the cash payment.`;

    await this.sendMessage(chatId, text);
  }

  async notifyPaymentReceived(
    chatId: string,
    orderNo: string,
    amount: number,
    receivedByName: string,
  ): Promise<void> {
    const text =
      `💵 <b>Payment Received!</b>\n\n` +
      `Payment of <b>$${Number(amount).toFixed(2)} CASH</b> received for order <b>#${orderNo}</b>.\n` +
      `Received by: <i>${receivedByName}</i>\n` +
      `Status: <b>PAID</b>`;

    await this.sendMessage(chatId, text);
  }

  async notifyOrderCompleted(chatId: string, orderNo: string): Promise<void> {
    const text =
      `🎉 <b>Order Completed!</b>\n\n` +
      `Order <b>#${orderNo}</b> is officially complete and closed.\n` +
      `Thank you for partnering with us!`;

    await this.sendMessage(chatId, text);
  }

  async notifyOrderRejected(
    chatId: string,
    orderNo: string,
    reason?: string,
  ): Promise<void> {
    const reasonStr = reason ? `\nReason: <i>${reason}</i>` : '';
    const text =
      `❌ <b>Order Update: Order #${orderNo} Rejected</b>\n` +
      `${reasonStr}\n\n` +
      `We apologize for the inconvenience. Please contact our staff if you have any questions.`;

    await this.sendMessage(chatId, text);
  }

  async sendWelcomeMenu(chatId: string | number, name: string): Promise<void> {
    const miniAppUrl = this.getMiniAppUrl();
    const text =
      `👋 <b>Welcome, ${name}!</b>\n\n` +
      `Welcome to the <b>Stock Management Partner Store</b>.\n` +
      `You can browse our live product catalog, check real-time stock availability, and place orders directly from Telegram!\n\n` +
      `💵 <i>All orders are paid by cash on delivery.</i>`;

    await this.sendMessage(chatId, text, [
      [
        {
          text: '🛍️ Open Partner Store',
          web_app: { url: miniAppUrl },
        },
      ],
      [
        {
          text: '📦 My Orders',
          web_app: { url: `${miniAppUrl}/orders` },
        },
      ],
    ]);
  }

  async notifyCustomerApproved(chatId: string, companyName?: string): Promise<void> {
    const miniAppUrl = this.getMiniAppUrl();
    const companyStr = companyName ? ` for <b>${companyName}</b>` : '';
    const text =
      `🎉 <b>Registration Approved!</b>\n\n` +
      `Your customer account${companyStr} has been approved.\n\n` +
      `You can now open our Mini App and place orders.`;

    await this.sendMessage(chatId, text, [
      [
        {
          text: '🛍️ Open Partner Store',
          web_app: { url: miniAppUrl },
        },
      ],
    ]);
  }

  async notifyCustomerRejected(chatId: string, reason: string): Promise<void> {
    const miniAppUrl = this.getMiniAppUrl();
    const text =
      `⚠️ <b>Registration Update</b>\n\n` +
      `Unfortunately, your registration was rejected.\n\n` +
      `<b>Reason:</b>\n<i>${reason}</i>\n\n` +
      `Please open the Mini App to review and update your information.`;

    await this.sendMessage(chatId, text, [
      [
        {
          text: '📝 Review & Update',
          web_app: { url: miniAppUrl },
        },
      ],
    ]);
  }
}


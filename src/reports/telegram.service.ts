import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { SalesReport } from './interfaces/report.interface';

@Injectable()
export class TelegramService {
  private readonly logger = new Logger(TelegramService.name);

  constructor(private readonly configService: ConfigService) {}

  private getCredentials(): { botToken: string; chatId: string } {
    const rawToken = this.configService.get<string>('TELEGRAM_BOT_TOKEN') || '';
    const rawChatId = this.configService.get<string>('TELEGRAM_CHAT_ID') || '';

    // Strip accidental wrapping quotes or spaces
    const botToken = rawToken.replace(/^["']|["']$/g, '').trim();
    const chatId = rawChatId.replace(/^["']|["']$/g, '').trim();

    return { botToken, chatId };
  }

  /**
   * Formats a SalesReport into a customized, elegant HTML Telegram message.
   */
  formatReportHtml(report: SalesReport): string {
    const isDaily = report.period === 'DAILY';
    const headerEmoji = isDaily ? '📊' : '📈';
    const reportTitle = isDaily
      ? 'DAILY SALES & INVENTORY REPORT'
      : 'WEEKLY SALES & INVENTORY REPORT';

    const formatDate = (date: Date) =>
      date.toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
      });

    const formatTime = (date: Date) =>
      date.toLocaleTimeString('en-US', {
        hour: '2-digit',
        minute: '2-digit',
        hour12: true,
      });

    const dateStr = isDaily
      ? `${formatDate(report.endDate)} | ${formatTime(report.endDate)}`
      : `${formatDate(report.startDate)} - ${formatDate(report.endDate)}`;

    const formatCurrency = (amount: number) => {
      const isNegative = amount < 0;
      const formatted = Math.abs(amount).toLocaleString('en-US', {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      });
      return isNegative ? `-$${formatted}` : `$${formatted}`;
    };

    const profitSign = report.netProfit >= 0 ? '+' : '';
    const profitColorTag =
      report.netProfit >= 0
        ? `<b>${profitSign}${formatCurrency(report.netProfit)}</b>`
        : `<b>${formatCurrency(report.netProfit)}</b>`;

    // 1. Top Products Breakdown (Stock Out)
    let salesProductsHtml = '';
    if (report.products.length === 0) {
      salesProductsHtml =
        '  <i>No stock-out sales recorded in this period.</i>\n';
    } else {
      const displayProducts = report.products.slice(0, 8);
      salesProductsHtml = displayProducts
        .map((p) => {
          const variantTag = p.variantName
            ? ` (${this.escapeHtml(p.variantName)})`
            : '';
          const pSign = p.profit >= 0 ? '+' : '';
          return (
            `  ▫️ <b>[${this.escapeHtml(p.productCode)}] ${this.escapeHtml(p.productName)}</b>${variantTag}\n` +
            `     Sold: <b>${p.quantitySold}</b> | Cost: ${formatCurrency(p.costPrice)} | Sell: ${formatCurrency(p.sellingPrice)}\n` +
            `     Profit: <b>${pSign}${formatCurrency(p.profit)}</b> (Margin: ${p.profitMargin.toFixed(1)}%)\n`
          );
        })
        .join('');

      if (report.products.length > 8) {
        salesProductsHtml += `  <i>...and ${report.products.length - 8} more products</i>\n`;
      }
    }

    // 2. Stock In Breakdown
    let stockInHtml = '';
    if (!report.stockIn || report.stockIn.totalUnitsReceived === 0) {
      stockInHtml = '  <i>No stock-in received in this period.</i>\n';
    } else {
      const displayStockIn = report.stockIn.items.slice(0, 5);
      stockInHtml =
        `├ <b>Units Received:</b> ${report.stockIn.totalUnitsReceived.toLocaleString()} items (${report.stockIn.totalTransactions} batches)\n` +
        `├ <b>Restock Value:</b> ${formatCurrency(report.stockIn.totalCost)}\n` +
        `└ <b>Restocked Items:</b>\n` +
        displayStockIn
          .map((item) => {
            const variantTag = item.variantName
              ? ` (${this.escapeHtml(item.variantName)})`
              : '';
            return (
              `  ▫️ <b>[${this.escapeHtml(item.productCode)}] ${this.escapeHtml(item.productName)}</b>${variantTag}\n` +
              `     Restocked: <b>+${item.quantityReceived}</b> units | Cost: ${formatCurrency(item.totalCost)}\n`
            );
          })
          .join('');

      if (report.stockIn.items.length > 5) {
        stockInHtml += `  <i>...and ${report.stockIn.items.length - 5} more restocked items</i>\n`;
      }
    }

    // 3. Stock Adjustments by Reason
    let adjustmentsHtml = '';
    if (
      !report.stockAdjustment ||
      report.stockAdjustment.totalAdjustments === 0
    ) {
      adjustmentsHtml =
        '  <i>No stock adjustments recorded in this period.</i>\n';
    } else {
      const adj = report.stockAdjustment;
      const netSign = adj.netQuantity > 0 ? '+' : '';
      adjustmentsHtml =
        `├ <b>Total Adjustments:</b> ${adj.totalAdjustments}\n` +
        `├ <b>Net Quantity:</b> ${netSign}${adj.netQuantity} units\n` +
        `├ 🔻 <b>Total Loss/Decrease:</b> -${adj.totalDecreaseQuantity} units (-${formatCurrency(adj.totalDecreaseValue)})\n` +
        `├ 🔺 <b>Total Surplus/Increase:</b> +${adj.totalIncreaseQuantity} units (+${formatCurrency(adj.totalIncreaseValue)})\n` +
        `└ <b>Breakdown by Reason:</b>\n`;

      adjustmentsHtml += adj.byReason
        .map((group) => {
          const isDec = group.adjustmentType === 'DECREASE';
          const icon = isDec ? '🔻' : '🔺';
          const sign = isDec ? '-' : '+';
          const reasonTitle = this.escapeHtml(group.reason);

          let groupText = `  ${icon} <b>${reasonTitle}</b> (${group.adjustmentType}):\n`;
          groupText += `     Qty: <b>${sign}${group.totalQuantity}</b> | Impact: <b>${sign}${formatCurrency(group.totalValue)}</b>\n`;

          const topItems = group.items.slice(0, 3);
          for (const it of topItems) {
            groupText += `     ▫️ ${this.escapeHtml(it.productName)}: ${sign}${it.quantity} units\n`;
          }
          if (group.items.length > 3) {
            groupText += `     <i>...and ${group.items.length - 3} more items</i>\n`;
          }

          return groupText;
        })
        .join('');
    }

    // 4. Low Stock Warnings
    let lowStockHtml = '';
    if (report.lowStockWarnings.length === 0) {
      lowStockHtml = '  <i>All warehouse stocks are within safe levels.</i>\n';
    } else {
      const displayWarnings = report.lowStockWarnings.slice(0, 5);
      lowStockHtml = displayWarnings
        .map((w) => {
          const variantTag = w.variantCode
            ? ` (${this.escapeHtml(w.variantCode)})`
            : '';
          return (
            `  ▫️ <b>${this.escapeHtml(w.productName)}</b>${variantTag}\n` +
            `     Current: <b>${w.currentStock}</b> | Min Required: <b>${w.minimumStock}</b>\n`
          );
        })
        .join('');

      if (report.lowStockWarnings.length > 5) {
        lowStockHtml += `  <i>...and ${report.lowStockWarnings.length - 5} more items low on stock</i>\n`;
      }
    }

    // Adjustment loss line in financial card if any loss occurred
    const adjustmentLossLine =
      report.stockAdjustment && report.stockAdjustment.totalDecreaseValue > 0
        ? `├ ⚠️ <b>Damage / Loss Value:</b> -${formatCurrency(report.stockAdjustment.totalDecreaseValue)}\n`
        : '';

    return (
      `${headerEmoji} <b>${reportTitle}</b>\n` +
      `📅 <i>${dateStr}</i>\n` +
      `━━━━━━━━━━━━━━━━━━━━\n\n` +
      `💰 <b>FINANCIAL PERFORMANCE</b>\n` +
      `├ 💵 <b>Total Revenue:</b> ${formatCurrency(report.totalRevenue)}\n` +
      `├ 🏷️ <b>Total Cost of Goods Sold:</b> ${formatCurrency(report.totalCost)}\n` +
      `├ 📈 <b>Net Profit:</b> ${profitColorTag}\n` +
      `├ 🎯 <b>Profit Margin:</b> <b>${report.profitMargin.toFixed(1)}%</b>\n` +
      `${adjustmentLossLine}` +
      `\n` +
      `📦 <b>SALES (STOCK OUT)</b>\n` +
      `├ <b>Units Sold:</b> ${report.totalUnitsSold.toLocaleString()} items\n` +
      `├ <b>Approved Requests:</b> ${report.totalTransactions}\n` +
      `└ <b>Product Highlights:</b>\n` +
      `${salesProductsHtml}\n` +
      `📥 <b>INCOMING INVENTORY (STOCK IN)</b>\n` +
      `${stockInHtml}\n` +
      `⚖️ <b>STOCK ADJUSTMENTS & AUDIT</b>\n` +
      `${adjustmentsHtml}\n` +
      `🏢 <b>INVENTORY HEALTH</b>\n` +
      `├ 📦 <b>Total Stock on Hand:</b> ${report.totalInventoryStock.toLocaleString()} units\n` +
      `└ ⚠️ <b>Low Stock Alerts (${report.lowStockWarnings.length}):</b>\n` +
      `${lowStockHtml}\n` +
      `━━━━━━━━━━━━━━━━━━━━\n` +
      `🤖 <i>Automated Notification • Stock Management System</i>`
    );
  }

  /**
   * Sends the sales report to Telegram chat.
   */
  async sendReport(
    report: SalesReport,
  ): Promise<{ sent: boolean; message: string }> {
    const { botToken, chatId } = this.getCredentials();

    if (!botToken || !chatId) {
      this.logger.warn(
        'Telegram credentials (TELEGRAM_BOT_TOKEN or TELEGRAM_CHAT_ID) are empty. Skipping Telegram delivery.',
      );
      return {
        sent: false,
        message:
          'Telegram credentials are empty or not configured. Set TELEGRAM_BOT_TOKEN and TELEGRAM_CHAT_ID in .env to enable Telegram alerts.',
      };
    }

    const text = this.formatReportHtml(report);
    const url = `https://api.telegram.org/bot${botToken}/sendMessage`;

    try {
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          chat_id: chatId,
          text,
          parse_mode: 'HTML',
          disable_web_page_preview: true,
        }),
      });

      const data = (await response.json()) as any;

      if (!response.ok || !data.ok) {
        this.logger.error(
          `Failed to send Telegram message: ${JSON.stringify(data)}`,
        );
        return {
          sent: false,
          message: `Telegram API error: ${data?.description || response.statusText}`,
        };
      }

      this.logger.log(
        `Successfully delivered ${report.period} report to Telegram chat ${chatId}`,
      );
      return {
        sent: true,
        message: `Successfully delivered ${report.period} report to Telegram.`,
      };
    } catch (error: any) {
      this.logger.error(
        `Error sending Telegram alert: ${error.message}`,
        error.stack,
      );
      return {
        sent: false,
        message: `Network error sending to Telegram: ${error.message}`,
      };
    }
  }

  private escapeHtml(str: string): string {
    return str
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }
}

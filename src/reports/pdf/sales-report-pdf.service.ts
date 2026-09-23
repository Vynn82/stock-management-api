import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as fs from 'fs';
import * as path from 'path';
import PDFDocument from 'pdfkit';
import {
  AdjustmentReasonGroup,
  LowStockWarning,
  ProductSalesSummary,
  SalesReport,
  StockInSummaryItem,
} from '../interfaces/report.interface';

// Color Palette - Modern Corporate / Enterprise Theme
const COLORS = {
  primary: '#0F172A', // Slate 900 (Main headings, bold text)
  secondary: '#334155', // Slate 700 (Body text, subheadings)
  muted: '#64748B', // Slate 500 (Labels, timestamps, footers)
  accent: '#1E40AF', // Blue 800 (Corporate brand accent)
  accentLight: '#EFF6FF', // Blue 50 (Accent background tint)
  border: '#E2E8F0', // Slate 200 (Light borders, dividers)
  surface: '#F8FAFC', // Slate 50 (Card backgrounds, alternating rows)
  white: '#FFFFFF',
  success: '#16A34A', // Green 600
  successBg: '#DCFCE7', // Green 100
  successText: '#15803D', // Green 700
  danger: '#DC2626', // Red 600
  dangerBg: '#FEE2E2', // Red 100
  dangerText: '#B91C1C', // Red 700
  warning: '#D97706', // Amber 600
  warningBg: '#FEF3C7', // Amber 100
  warningText: '#B45309', // Amber 700
};

// Geometry constants
const NEW_PAGE_TOP_PADDING = 68; // Generous breathing room on top for second page and beyond

@Injectable()
export class SalesReportPdfService {
  private readonly logger = new Logger(SalesReportPdfService.name);

  constructor(private readonly configService: ConfigService) {}

  /**
   * Generates a corporate, highly-polished PDF report from a SalesReport object.
   */
  async generateReportPdf(report: SalesReport): Promise<Buffer> {
    return new Promise<Buffer>((resolve, reject) => {
      try {
        const doc = new PDFDocument({
          size: 'A4',
          margin: 36, // 0.5 inch margins
          bufferPages: true,
          autoFirstPage: true,
          info: {
            Title: report.title,
            Author: 'Stock Management System',
            Subject: `${report.period} Sales & Inventory Report`,
            CreationDate: new Date(),
          },
        });

        const chunks: Buffer[] = [];
        doc.on('data', (chunk) => chunks.push(chunk));
        doc.on('end', () => resolve(Buffer.concat(chunks)));
        doc.on('error', (err) => {
          this.logger.error(`PDFKit rendering error: ${err.message}`, err.stack);
          reject(err);
        });

        this.renderDocument(doc, report);

        doc.end();
      } catch (error) {
        this.logger.error(
          `Failed to initialize PDF generation: ${error.message}`,
          error.stack,
        );
        reject(error);
      }
    });
  }

  /**
   * Orchestrates the rendering of all report sections.
   */
  private renderDocument(
    doc: InstanceType<typeof PDFDocument>,
    report: SalesReport,
  ): void {
    const pageWidth = doc.page.width; // 595.28
    const margin = 36;
    const contentWidth = pageWidth - margin * 2; // 523.28

    // 1. Header (Logo & Report Meta)
    let currentY = this.renderHeader(doc, report, margin, contentWidth);

    // 2. Executive Summary Cards
    currentY = this.renderExecutiveSummary(
      doc,
      report,
      margin,
      contentWidth,
      currentY + 12,
    );

    // 3. Financial Performance Section
    currentY = this.renderFinancialPerformance(
      doc,
      report,
      margin,
      contentWidth,
      currentY + 16,
    );

    // 4. Sales Performance Table
    currentY = this.renderSalesPerformance(
      doc,
      report,
      margin,
      contentWidth,
      currentY + 16,
    );

    // 5. Incoming Inventory Table
    currentY = this.renderIncomingInventory(
      doc,
      report,
      margin,
      contentWidth,
      currentY + 16,
    );

    // 6. Stock Adjustments & Audit
    currentY = this.renderStockAdjustments(
      doc,
      report,
      margin,
      contentWidth,
      currentY + 16,
    );

    // 7. Inventory Health & Low Stock
    currentY = this.renderInventoryHealth(
      doc,
      report,
      margin,
      contentWidth,
      currentY + 16,
    );

    // 8. Professional Footers across all pages
    this.renderFooters(doc, margin, contentWidth);
  }

  // ==========================================================================
  // SECTION 1: REPORT HEADER & LOGO
  // ==========================================================================

  private renderHeader(
    doc: InstanceType<typeof PDFDocument>,
    report: SalesReport,
    margin: number,
    contentWidth: number,
  ): number {
    const startY = margin;
    const isDaily = report.period === 'DAILY';
    const reportTitle = isDaily
      ? 'DAILY SALES & INVENTORY REPORT'
      : 'WEEKLY SALES & INVENTORY REPORT';

    const periodLabel = isDaily
      ? this.formatDate(report.endDate)
      : `${this.formatDate(report.startDate)} — ${this.formatDate(report.endDate)}`;

    const generatedTimestamp = `${this.formatDate(new Date())} • ${this.formatTime(new Date())}`;

    // Resolve Logo
    const configuredLogoPath =
      this.configService.get<string>('REPORT_LOGO_PATH') || 'assets/logo.png';
    const resolvedLogoPath = path.isAbsolute(configuredLogoPath)
      ? configuredLogoPath
      : path.resolve(process.cwd(), configuredLogoPath);

    let hasLogo = false;
    if (fs.existsSync(resolvedLogoPath)) {
      try {
        hasLogo = true;
        doc.image(resolvedLogoPath, margin, startY, {
          fit: [100, 48],
          valign: 'center',
        });
      } catch (e) {
        this.logger.warn(
          `Could not render logo from ${resolvedLogoPath}: ${e.message}. Falling back to text header.`,
        );
        hasLogo = false;
      }
    }

    const titleX = hasLogo ? margin + 112 : margin;
    const titleWidth = contentWidth - (hasLogo ? 112 : 0) - 170;

    // Company & Report Title
    doc
      .font('Helvetica-Bold')
      .fontSize(14)
      .fillColor(COLORS.primary)
      .text('STOCK MANAGEMENT SYSTEM', titleX, startY + 2, {
        width: titleWidth,
      });

    doc
      .font('Helvetica-Bold')
      .fontSize(11)
      .fillColor(COLORS.accent)
      .text(reportTitle, titleX, startY + 20, {
        width: titleWidth,
      });

    doc
      .font('Helvetica')
      .fontSize(8.5)
      .fillColor(COLORS.muted)
      .text(`Reporting Period: ${periodLabel}`, titleX, startY + 36, {
        width: titleWidth,
      });

    // Right-aligned Metadata Box
    const metaBoxX = margin + contentWidth - 165;
    const metaBoxWidth = 165;

    doc
      .font('Helvetica-Bold')
      .fontSize(7.5)
      .fillColor(COLORS.muted)
      .text('REPORT GENERATED', metaBoxX, startY + 4, {
        width: metaBoxWidth,
        align: 'right',
      });

    doc
      .font('Helvetica')
      .fontSize(8.5)
      .fillColor(COLORS.primary)
      .text(generatedTimestamp, metaBoxX, startY + 16, {
        width: metaBoxWidth,
        align: 'right',
      });

    // Subtle Badge: Confidential
    const badgeW = 100;
    const badgeH = 14;
    const badgeX = margin + contentWidth - badgeW;
    const badgeY = startY + 34;

    doc
      .roundedRect(badgeX, badgeY, badgeW, badgeH, 6)
      .fillColor(COLORS.surface)
      .fill();
    doc
      .roundedRect(badgeX, badgeY, badgeW, badgeH, 6)
      .strokeColor(COLORS.border)
      .lineWidth(0.5)
      .stroke();

    doc
      .font('Helvetica-Bold')
      .fontSize(6.5)
      .fillColor(COLORS.muted)
      .text('CONFIDENTIAL REPORT', badgeX, badgeY + 3.5, {
        width: badgeW,
        align: 'center',
      });

    // Divider Rule
    const dividerY = startY + 56;
    doc
      .strokeColor(COLORS.border)
      .lineWidth(0.75)
      .moveTo(margin, dividerY)
      .lineTo(margin + contentWidth, dividerY)
      .stroke();

    return dividerY;
  }

  // ==========================================================================
  // SECTION 2: EXECUTIVE SUMMARY
  // ==========================================================================

  private renderExecutiveSummary(
    doc: InstanceType<typeof PDFDocument>,
    report: SalesReport,
    margin: number,
    contentWidth: number,
    startY: number,
  ): number {
    this.drawSectionHeader(doc, 'EXECUTIVE SUMMARY', margin, startY);

    const cardsY = startY + 18;
    const cardGap = 8;
    const cardCount = 4;
    const cardWidth = (contentWidth - cardGap * (cardCount - 1)) / cardCount;
    const cardHeight = 44;

    // Card 1: Total Revenue
    this.drawSummaryCard(
      doc,
      margin,
      cardsY,
      cardWidth,
      cardHeight,
      'TOTAL REVENUE',
      this.formatCurrency(report.totalRevenue),
      COLORS.primary,
    );

    // Card 2: Net Profit
    const profitColor =
      report.netProfit >= 0 ? COLORS.successText : COLORS.dangerText;
    const profitSign = report.netProfit >= 0 ? '+' : '';
    this.drawSummaryCard(
      doc,
      margin + (cardWidth + cardGap),
      cardsY,
      cardWidth,
      cardHeight,
      'NET PROFIT',
      `${profitSign}${this.formatCurrency(report.netProfit)}`,
      profitColor,
    );

    // Card 3: Profit Margin
    const marginColor =
      report.profitMargin >= 0 ? COLORS.primary : COLORS.dangerText;
    this.drawSummaryCard(
      doc,
      margin + (cardWidth + cardGap) * 2,
      cardsY,
      cardWidth,
      cardHeight,
      'PROFIT MARGIN',
      `${report.profitMargin.toFixed(1)}%`,
      marginColor,
    );

    // Card 4: Units Sold
    this.drawSummaryCard(
      doc,
      margin + (cardWidth + cardGap) * 3,
      cardsY,
      cardWidth,
      cardHeight,
      'UNITS SOLD',
      this.formatNumber(report.totalUnitsSold),
      COLORS.primary,
    );

    // Alert Banner: Low Stock
    const bannerY = cardsY + cardHeight + 8;
    const bannerHeight = 22;
    const lowCount = report.lowStockWarnings?.length || 0;

    if (lowCount > 0) {
      this.drawAlertBanner(
        doc,
        margin,
        bannerY,
        contentWidth,
        bannerHeight,
        `LOW STOCK ALERT: ${lowCount} item${lowCount === 1 ? '' : 's'} require immediate restocking attention`,
        true,
      );
    } else {
      this.drawAlertBanner(
        doc,
        margin,
        bannerY,
        contentWidth,
        bannerHeight,
        'INVENTORY HEALTH: All warehouse items maintain stock levels within safe thresholds',
        false,
      );
    }

    return bannerY + bannerHeight;
  }

  // ==========================================================================
  // SECTION 3: FINANCIAL PERFORMANCE
  // ==========================================================================

  private renderFinancialPerformance(
    doc: InstanceType<typeof PDFDocument>,
    report: SalesReport,
    margin: number,
    contentWidth: number,
    startY: number,
  ): number {
    this.drawSectionHeader(doc, 'FINANCIAL PERFORMANCE', margin, startY);

    const tableY = startY + 18;
    const rowHeight = 18;
    const totalLossValue = report.stockAdjustment?.totalDecreaseValue || 0;

    const rows: {
      label: string;
      value: string;
      bold?: boolean;
      color?: string;
    }[] = [
      {
        label: 'Total Revenue (Stock Out)',
        value: this.formatCurrency(report.totalRevenue),
      },
      {
        label: 'Cost of Goods Sold (COGS)',
        value: this.formatCurrency(report.totalCost),
      },
      {
        label: 'Net Operating Profit',
        value: `${report.netProfit >= 0 ? '+' : ''}${this.formatCurrency(report.netProfit)}`,
        bold: true,
        color: report.netProfit >= 0 ? COLORS.successText : COLORS.dangerText,
      },
      {
        label: 'Profit Margin',
        value: `${report.profitMargin.toFixed(1)}%`,
        bold: true,
      },
    ];

    if (totalLossValue > 0) {
      rows.push({
        label: 'Inventory Damage / Loss Value',
        value: `-${this.formatCurrency(totalLossValue)}`,
        color: COLORS.dangerText,
      });
    }

    // Outer Container
    const containerHeight = rows.length * rowHeight + 10;
    doc
      .roundedRect(margin, tableY, contentWidth, containerHeight, 6)
      .fillColor(COLORS.surface)
      .fill();
    doc
      .roundedRect(margin, tableY, contentWidth, containerHeight, 6)
      .strokeColor(COLORS.border)
      .lineWidth(0.5)
      .stroke();

    let rowY = tableY + 5;
    for (let i = 0; i < rows.length; i++) {
      const item = rows[i];
      const isLast = i === rows.length - 1;

      doc
        .font(item.bold ? 'Helvetica-Bold' : 'Helvetica')
        .fontSize(8.5)
        .fillColor(COLORS.secondary)
        .text(item.label, margin + 14, rowY + 4, {
          width: 300,
        });

      doc
        .font(item.bold ? 'Helvetica-Bold' : 'Helvetica')
        .fontSize(8.5)
        .fillColor(item.color || COLORS.primary)
        .text(item.value, margin + contentWidth - 160, rowY + 4, {
          width: 146,
          align: 'right',
        });

      if (!isLast) {
        doc
          .strokeColor(COLORS.border)
          .lineWidth(0.5)
          .moveTo(margin + 10, rowY + rowHeight)
          .lineTo(margin + contentWidth - 10, rowY + rowHeight)
          .stroke();
      }

      rowY += rowHeight;
    }

    return tableY + containerHeight;
  }

  // ==========================================================================
  // SECTION 4: SALES PERFORMANCE (STOCK OUT)
  // ==========================================================================

  private renderSalesPerformance(
    doc: InstanceType<typeof PDFDocument>,
    report: SalesReport,
    margin: number,
    contentWidth: number,
    startY: number,
  ): number {
    let currentY = this.ensureSpace(doc, startY, 70, margin, contentWidth);
    this.drawSectionHeader(doc, 'SALES PERFORMANCE (STOCK OUT)', margin, currentY);

    // Summary Subtext
    currentY += 16;
    doc
      .font('Helvetica')
      .fontSize(8)
      .fillColor(COLORS.muted)
      .text(
        `Total Units Sold: ${this.formatNumber(report.totalUnitsSold)} items  |  Approved Orders: ${report.totalTransactions}  |  Products Recorded: ${report.products?.length || 0}`,
        margin,
        currentY,
      );
    currentY += 12;

    // Table Columns: Code (56), Product (140), Variant (78), Qty (34), Cost (52), Selling (52), Profit (62), Margin (42)
    // Total = 516 pt
    const cols = [
      { key: 'code', label: 'Code', width: 56, align: 'left' as const },
      { key: 'product', label: 'Product', width: 140, align: 'left' as const },
      { key: 'variant', label: 'Variant', width: 78, align: 'left' as const },
      { key: 'qty', label: 'Qty', width: 34, align: 'right' as const },
      { key: 'cost', label: 'Cost', width: 52, align: 'right' as const },
      { key: 'selling', label: 'Selling', width: 52, align: 'right' as const },
      { key: 'profit', label: 'Profit', width: 62, align: 'right' as const },
      { key: 'margin', label: 'Margin', width: 42, align: 'right' as const },
    ];

    if (!report.products || report.products.length === 0) {
      return this.drawEmptyStateBox(
        doc,
        margin,
        currentY,
        contentWidth,
        'No stock-out sales recorded in this period.',
      );
    }

    // Draw Table Header
    let tableStartY = currentY;
    currentY = this.drawTableHeader(doc, cols, margin, currentY);

    // Draw Rows
    const rowHeight = 17;
    for (let i = 0; i < report.products.length; i++) {
      const p = report.products[i];

      // Check for page break
      if (currentY + rowHeight > 780) {
        doc
          .roundedRect(margin, tableStartY, contentWidth, currentY - tableStartY, 6)
          .strokeColor(COLORS.border)
          .lineWidth(0.5)
          .stroke();

        doc.addPage();
        currentY = NEW_PAGE_TOP_PADDING;
        tableStartY = currentY;
        currentY = this.drawTableHeader(doc, cols, margin, currentY);
      }

      const isEven = i % 2 === 0;
      if (isEven) {
        doc
          .rect(margin, currentY, contentWidth, rowHeight)
          .fillColor(COLORS.surface)
          .fill();
      }

      // Border bottom
      doc
        .strokeColor(COLORS.border)
        .lineWidth(0.4)
        .moveTo(margin, currentY + rowHeight)
        .lineTo(margin + contentWidth, currentY + rowHeight)
        .stroke();

      let cellX = margin + 4;
      const textY = currentY + 4.5;

      // 1. Code
      doc
        .font('Helvetica-Bold')
        .fontSize(7.5)
        .fillColor(COLORS.secondary)
        .text(
          this.fitText(doc, p.productCode || '-', cols[0].width - 4),
          cellX,
          textY,
          {
            width: cols[0].width - 4,
            lineBreak: false,
          },
        );
      cellX += cols[0].width;

      // 2. Product Name
      doc
        .font('Helvetica')
        .fontSize(7.5)
        .fillColor(COLORS.primary)
        .text(
          this.fitText(doc, p.productName || '-', cols[1].width - 6),
          cellX,
          textY,
          {
            width: cols[1].width - 6,
            lineBreak: false,
          },
        );
      cellX += cols[1].width;

      // 3. Variant
      doc
        .font('Helvetica')
        .fontSize(7.5)
        .fillColor(COLORS.muted)
        .text(
          this.fitText(
            doc,
            p.variantName || p.variantCode || '-',
            cols[2].width - 6,
          ),
          cellX,
          textY,
          {
            width: cols[2].width - 6,
            lineBreak: false,
          },
        );
      cellX += cols[2].width;

      // 4. Qty
      doc
        .font('Helvetica-Bold')
        .fontSize(7.5)
        .fillColor(COLORS.primary)
        .text(this.formatNumber(p.quantitySold), cellX, textY, {
          width: cols[3].width - 4,
          align: 'right',
          lineBreak: false,
        });
      cellX += cols[3].width;

      // 5. Cost
      doc
        .font('Helvetica')
        .fontSize(7.5)
        .fillColor(COLORS.secondary)
        .text(this.formatCurrency(p.costPrice), cellX, textY, {
          width: cols[4].width - 4,
          align: 'right',
          lineBreak: false,
        });
      cellX += cols[4].width;

      // 6. Selling
      doc
        .font('Helvetica')
        .fontSize(7.5)
        .fillColor(COLORS.secondary)
        .text(this.formatCurrency(p.sellingPrice), cellX, textY, {
          width: cols[5].width - 4,
          align: 'right',
          lineBreak: false,
        });
      cellX += cols[5].width;

      // 7. Profit
      const profitSign = p.profit >= 0 ? '+' : '';
      doc
        .font('Helvetica-Bold')
        .fontSize(7.5)
        .fillColor(p.profit >= 0 ? COLORS.successText : COLORS.dangerText)
        .text(`${profitSign}${this.formatCurrency(p.profit)}`, cellX, textY, {
          width: cols[6].width - 4,
          align: 'right',
          lineBreak: false,
        });
      cellX += cols[6].width;

      // 8. Margin
      doc
        .font('Helvetica')
        .fontSize(7.5)
        .fillColor(p.profitMargin >= 0 ? COLORS.secondary : COLORS.dangerText)
        .text(`${p.profitMargin.toFixed(1)}%`, cellX, textY, {
          width: cols[7].width - 4,
          align: 'right',
          lineBreak: false,
        });

      currentY += rowHeight;
    }

    doc
      .roundedRect(margin, tableStartY, contentWidth, currentY - tableStartY, 6)
      .strokeColor(COLORS.border)
      .lineWidth(0.5)
      .stroke();

    return currentY;
  }

  // ==========================================================================
  // SECTION 5: INCOMING INVENTORY (STOCK IN)
  // ==========================================================================

  private renderIncomingInventory(
    doc: InstanceType<typeof PDFDocument>,
    report: SalesReport,
    margin: number,
    contentWidth: number,
    startY: number,
  ): number {
    let currentY = this.ensureSpace(doc, startY, 70, margin, contentWidth);
    this.drawSectionHeader(
      doc,
      'INCOMING INVENTORY (STOCK IN)',
      margin,
      currentY,
    );

    const stockIn = report.stockIn;
    currentY += 16;

    if (!stockIn || stockIn.totalUnitsReceived === 0) {
      return this.drawEmptyStateBox(
        doc,
        margin,
        currentY,
        contentWidth,
        'No incoming inventory recorded during this period.',
      );
    }

    // Summary Subtext
    doc
      .font('Helvetica')
      .fontSize(8)
      .fillColor(COLORS.muted)
      .text(
        `Units Received: ${this.formatNumber(stockIn.totalUnitsReceived)}  |  Total Batches: ${stockIn.totalTransactions}  |  Total Restock Cost: ${this.formatCurrency(stockIn.totalCost)}`,
        margin,
        currentY,
      );
    currentY += 12;

    const cols = [
      { key: 'code', label: 'Product Code', width: 75, align: 'left' as const },
      { key: 'product', label: 'Product Name', width: 175, align: 'left' as const },
      { key: 'variant', label: 'Variant', width: 95, align: 'left' as const },
      { key: 'qty', label: 'Qty Received', width: 75, align: 'right' as const },
      { key: 'cost', label: 'Total Cost', width: 90, align: 'right' as const },
    ];

    let tableStartY = currentY;
    currentY = this.drawTableHeader(doc, cols, margin, currentY);

    const rowHeight = 17;
    for (let i = 0; i < stockIn.items.length; i++) {
      const item = stockIn.items[i];

      if (currentY + rowHeight > 780) {
        doc
          .roundedRect(margin, tableStartY, contentWidth, currentY - tableStartY, 6)
          .strokeColor(COLORS.border)
          .lineWidth(0.5)
          .stroke();

        doc.addPage();
        currentY = NEW_PAGE_TOP_PADDING;
        tableStartY = currentY;
        currentY = this.drawTableHeader(doc, cols, margin, currentY);
      }

      if (i % 2 === 0) {
        doc
          .rect(margin, currentY, contentWidth, rowHeight)
          .fillColor(COLORS.surface)
          .fill();
      }

      doc
        .strokeColor(COLORS.border)
        .lineWidth(0.4)
        .moveTo(margin, currentY + rowHeight)
        .lineTo(margin + contentWidth, currentY + rowHeight)
        .stroke();

      let cellX = margin + 4;
      const textY = currentY + 4.5;

      // 1. Code
      doc
        .font('Helvetica-Bold')
        .fontSize(7.5)
        .fillColor(COLORS.secondary)
        .text(
          this.fitText(doc, item.productCode || '-', cols[0].width - 4),
          cellX,
          textY,
          {
            width: cols[0].width - 4,
            lineBreak: false,
          },
        );
      cellX += cols[0].width;

      // 2. Product Name
      doc
        .font('Helvetica')
        .fontSize(7.5)
        .fillColor(COLORS.primary)
        .text(
          this.fitText(doc, item.productName || '-', cols[1].width - 6),
          cellX,
          textY,
          {
            width: cols[1].width - 6,
            lineBreak: false,
          },
        );
      cellX += cols[1].width;

      // 3. Variant
      doc
        .font('Helvetica')
        .fontSize(7.5)
        .fillColor(COLORS.muted)
        .text(
          this.fitText(
            doc,
            item.variantName || item.variantCode || '-',
            cols[2].width - 6,
          ),
          cellX,
          textY,
          {
            width: cols[2].width - 6,
            lineBreak: false,
          },
        );
      cellX += cols[2].width;

      // 4. Qty
      doc
        .font('Helvetica-Bold')
        .fontSize(7.5)
        .fillColor(COLORS.successText)
        .text(`+${this.formatNumber(item.quantityReceived)}`, cellX, textY, {
          width: cols[3].width - 4,
          align: 'right',
          lineBreak: false,
        });
      cellX += cols[3].width;

      // 5. Total Cost
      doc
        .font('Helvetica')
        .fontSize(7.5)
        .fillColor(COLORS.secondary)
        .text(this.formatCurrency(item.totalCost), cellX, textY, {
          width: cols[4].width - 4,
          align: 'right',
          lineBreak: false,
        });

      currentY += rowHeight;
    }

    doc
      .roundedRect(margin, tableStartY, contentWidth, currentY - tableStartY, 6)
      .strokeColor(COLORS.border)
      .lineWidth(0.5)
      .stroke();

    return currentY;
  }

  // ==========================================================================
  // SECTION 6: STOCK ADJUSTMENTS & AUDIT
  // ==========================================================================

  private renderStockAdjustments(
    doc: InstanceType<typeof PDFDocument>,
    report: SalesReport,
    margin: number,
    contentWidth: number,
    startY: number,
  ): number {
    let currentY = this.ensureSpace(doc, startY, 80, margin, contentWidth);
    this.drawSectionHeader(
      doc,
      'STOCK ADJUSTMENTS & AUDIT',
      margin,
      currentY,
    );

    const adj = report.stockAdjustment;
    currentY += 16;

    if (!adj || adj.totalAdjustments === 0) {
      return this.drawEmptyStateBox(
        doc,
        margin,
        currentY,
        contentWidth,
        'No stock adjustments recorded during this period.',
      );
    }

    // Mini KPI strip: 4 boxes
    const miniW = (contentWidth - 18) / 4;
    const miniH = 34;

    const netSign = adj.netQuantity > 0 ? '+' : '';
    this.drawMiniMetric(
      doc,
      margin,
      currentY,
      miniW,
      miniH,
      'TOTAL EVENTS',
      `${adj.totalAdjustments} audits`,
    );
    this.drawMiniMetric(
      doc,
      margin + miniW + 6,
      currentY,
      miniW,
      miniH,
      'NET QUANTITY',
      `${netSign}${adj.netQuantity} units`,
      adj.netQuantity >= 0 ? COLORS.primary : COLORS.dangerText,
    );
    this.drawMiniMetric(
      doc,
      margin + (miniW + 6) * 2,
      currentY,
      miniW,
      miniH,
      'TOTAL LOSS / DECREASE',
      `-${adj.totalDecreaseQuantity} (${this.formatCurrency(adj.totalDecreaseValue)})`,
      COLORS.dangerText,
    );
    this.drawMiniMetric(
      doc,
      margin + (miniW + 6) * 3,
      currentY,
      miniW,
      miniH,
      'TOTAL SURPLUS / INCREASE',
      `+${adj.totalIncreaseQuantity} (${this.formatCurrency(adj.totalIncreaseValue)})`,
      COLORS.successText,
    );

    currentY += miniH + 10;

    // Table of Adjustments by Reason
    const cols = [
      { key: 'reason', label: 'Adjustment Reason', width: 160, align: 'left' as const },
      { key: 'type', label: 'Type', width: 85, align: 'center' as const },
      { key: 'qty', label: 'Total Quantity', width: 110, align: 'right' as const },
      { key: 'value', label: 'Total Value Impact', width: 130, align: 'right' as const },
    ];

    let tableStartY = currentY;
    currentY = this.drawTableHeader(doc, cols, margin, currentY);

    for (let i = 0; i < adj.byReason.length; i++) {
      const group = adj.byReason[i];
      const isDecrease = group.adjustmentType === 'DECREASE';
      const typeColor = isDecrease ? COLORS.dangerText : COLORS.successText;
      const typeBg = isDecrease ? COLORS.dangerBg : COLORS.successBg;
      const sign = isDecrease ? '-' : '+';

      // Height: group header row (18) + item rows (14 each)
      const subItemCount = group.items?.length || 0;
      const groupHeight = 18 + subItemCount * 14;

      if (currentY + Math.min(groupHeight, 60) > 780) {
        doc
          .roundedRect(margin, tableStartY, contentWidth, currentY - tableStartY, 6)
          .strokeColor(COLORS.border)
          .lineWidth(0.5)
          .stroke();

        doc.addPage();
        currentY = NEW_PAGE_TOP_PADDING;
        tableStartY = currentY;
        currentY = this.drawTableHeader(doc, cols, margin, currentY);
      }

      // Main Reason Row
      doc
        .rect(margin, currentY, contentWidth, 18)
        .fillColor(COLORS.surface)
        .fill();

      // Badge for type (pill shape radius 6)
      const badgeW = 60;
      const badgeH = 12;
      const badgeX = margin + 160 + (85 - badgeW) / 2;
      const badgeY = currentY + 3;

      doc.roundedRect(badgeX, badgeY, badgeW, badgeH, 6).fillColor(typeBg).fill();
      doc
        .font('Helvetica-Bold')
        .fontSize(6.5)
        .fillColor(typeColor)
        .text(group.adjustmentType, badgeX, badgeY + 2.5, {
          width: badgeW,
          align: 'center',
        });

      // Reason Label
      doc
        .font('Helvetica-Bold')
        .fontSize(8)
        .fillColor(COLORS.primary)
        .text(group.reason || 'General Adjustment', margin + 6, currentY + 4.5, {
          width: 150,
          ellipsis: true,
          lineBreak: false,
        });

      // Qty
      doc
        .font('Helvetica-Bold')
        .fontSize(8)
        .fillColor(typeColor)
        .text(`${sign}${this.formatNumber(group.totalQuantity)} units`, margin + 250, currentY + 4.5, {
          width: 104,
          align: 'right',
          lineBreak: false,
        });

      // Value
      doc
        .font('Helvetica-Bold')
        .fontSize(8)
        .fillColor(typeColor)
        .text(`${sign}${this.formatCurrency(group.totalValue)}`, margin + 360, currentY + 4.5, {
          width: 124,
          align: 'right',
          lineBreak: false,
        });

      currentY += 18;

      // Sub-items breakdown underneath
      if (group.items && group.items.length > 0) {
        for (const it of group.items) {
          if (currentY + 14 > 780) {
            doc
              .roundedRect(margin, tableStartY, contentWidth, currentY - tableStartY, 6)
              .strokeColor(COLORS.border)
              .lineWidth(0.5)
              .stroke();

            doc.addPage();
            currentY = NEW_PAGE_TOP_PADDING;
            tableStartY = currentY;
            currentY = this.drawTableHeader(doc, cols, margin, currentY);
          }

          doc
            .font('Helvetica')
            .fontSize(7)
            .fillColor(COLORS.muted)
            .text(`• ${it.productName}${it.variantCode ? ` (${it.variantCode})` : ''}`, margin + 16, currentY + 3, {
              width: 250,
              ellipsis: true,
              lineBreak: false,
            });

          doc
            .font('Helvetica')
            .fontSize(7)
            .fillColor(COLORS.secondary)
            .text(`${sign}${it.quantity} units  |  ${sign}${this.formatCurrency(it.value)}`, margin + 280, currentY + 3, {
              width: 200,
              align: 'right',
              lineBreak: false,
            });

          currentY += 14;
        }
      }

      doc
        .strokeColor(COLORS.border)
        .lineWidth(0.4)
        .moveTo(margin, currentY)
        .lineTo(margin + contentWidth, currentY)
        .stroke();
    }

    doc
      .roundedRect(margin, tableStartY, contentWidth, currentY - tableStartY, 6)
      .strokeColor(COLORS.border)
      .lineWidth(0.5)
      .stroke();

    return currentY;
  }

  // ==========================================================================
  // SECTION 7: INVENTORY HEALTH & LOW STOCK ALERTS
  // ==========================================================================

  private renderInventoryHealth(
    doc: InstanceType<typeof PDFDocument>,
    report: SalesReport,
    margin: number,
    contentWidth: number,
    startY: number,
  ): number {
    let currentY = this.ensureSpace(doc, startY, 70, margin, contentWidth);
    this.drawSectionHeader(
      doc,
      'INVENTORY HEALTH & STOCK LEVELS',
      margin,
      currentY,
    );

    currentY += 16;
    const lowCount = report.lowStockWarnings?.length || 0;

    // Summary Subtext
    doc
      .font('Helvetica')
      .fontSize(8)
      .fillColor(COLORS.muted)
      .text(
        `Total Stock on Hand: ${this.formatNumber(report.totalInventoryStock)} units  |  Low Stock Alerts: ${lowCount} item${lowCount === 1 ? '' : 's'}`,
        margin,
        currentY,
      );
    currentY += 12;

    if (lowCount === 0) {
      doc
        .font('Helvetica-Oblique')
        .fontSize(8.5)
        .fillColor(COLORS.successText)
        .text(
          'All warehouse stock levels are currently within safe operational thresholds.',
          margin + 8,
          currentY + 4,
        );
      return currentY + 20;
    }

    const cols = [
      { key: 'product', label: 'Product Name', width: 175, align: 'left' as const },
      { key: 'variant', label: 'Variant', width: 100, align: 'left' as const },
      { key: 'current', label: 'Current Stock', width: 80, align: 'right' as const },
      { key: 'min', label: 'Minimum Required', width: 90, align: 'right' as const },
      { key: 'status', label: 'Status', width: 65, align: 'center' as const },
    ];

    let tableStartY = currentY;
    currentY = this.drawTableHeader(doc, cols, margin, currentY);

    const rowHeight = 17;
    for (let i = 0; i < report.lowStockWarnings.length; i++) {
      const w = report.lowStockWarnings[i];

      if (currentY + rowHeight > 780) {
        doc
          .roundedRect(margin, tableStartY, contentWidth, currentY - tableStartY, 6)
          .strokeColor(COLORS.border)
          .lineWidth(0.5)
          .stroke();

        doc.addPage();
        currentY = NEW_PAGE_TOP_PADDING;
        tableStartY = currentY;
        currentY = this.drawTableHeader(doc, cols, margin, currentY);
      }

      if (i % 2 === 0) {
        doc
          .rect(margin, currentY, contentWidth, rowHeight)
          .fillColor(COLORS.surface)
          .fill();
      }

      doc
        .strokeColor(COLORS.border)
        .lineWidth(0.4)
        .moveTo(margin, currentY + rowHeight)
        .lineTo(margin + contentWidth, currentY + rowHeight)
        .stroke();

      let cellX = margin + 4;
      const textY = currentY + 4.5;

      // 1. Product Name
      doc
        .font('Helvetica-Bold')
        .fontSize(7.5)
        .fillColor(COLORS.primary)
        .text(
          this.fitText(doc, w.productName || '-', cols[0].width - 6),
          cellX,
          textY,
          {
            width: cols[0].width - 6,
            lineBreak: false,
          },
        );
      cellX += cols[0].width;

      // 2. Variant
      doc
        .font('Helvetica')
        .fontSize(7.5)
        .fillColor(COLORS.muted)
        .text(
          this.fitText(doc, w.variantCode || '-', cols[1].width - 6),
          cellX,
          textY,
          {
            width: cols[1].width - 6,
            lineBreak: false,
          },
        );
      cellX += cols[1].width;

      // 3. Current Stock
      doc
        .font('Helvetica-Bold')
        .fontSize(7.5)
        .fillColor(COLORS.dangerText)
        .text(this.formatNumber(w.currentStock), cellX, textY, {
          width: cols[2].width - 4,
          align: 'right',
          lineBreak: false,
        });
      cellX += cols[2].width;

      // 4. Minimum Required
      doc
        .font('Helvetica')
        .fontSize(7.5)
        .fillColor(COLORS.secondary)
        .text(this.formatNumber(w.minimumStock), cellX, textY, {
          width: cols[3].width - 4,
          align: 'right',
          lineBreak: false,
        });
      cellX += cols[3].width;

      // 5. Status Badge
      const isCritical = w.currentStock <= 0;
      const badgeText = isCritical ? 'CRITICAL' : 'LOW STOCK';
      const badgeBg = isCritical ? COLORS.dangerBg : COLORS.warningBg;
      const badgeColor = isCritical ? COLORS.dangerText : COLORS.warningText;
      const badgeW = 56;
      const badgeH = 11;
      const badgeX = cellX + (cols[4].width - badgeW) / 2;
      const badgeY = currentY + 3;

      doc.roundedRect(badgeX, badgeY, badgeW, badgeH, 6).fillColor(badgeBg).fill();
      doc
        .font('Helvetica-Bold')
        .fontSize(6)
        .fillColor(badgeColor)
        .text(badgeText, badgeX, badgeY + 2.5, {
          width: badgeW,
          align: 'center',
          lineBreak: false,
        });

      currentY += rowHeight;
    }

    doc
      .roundedRect(margin, tableStartY, contentWidth, currentY - tableStartY, 6)
      .strokeColor(COLORS.border)
      .lineWidth(0.5)
      .stroke();

    return currentY;
  }

  // ==========================================================================
  // SECTION 8: TWO-PASS PAGE NUMBERING & CORPORATE FOOTERS
  // ==========================================================================

  private renderFooters(
    doc: InstanceType<typeof PDFDocument>,
    margin: number,
    contentWidth: number,
  ): void {
    const range = doc.bufferedPageRange();
    const totalPages = range.count;

    for (let i = 0; i < totalPages; i++) {
      doc.switchToPage(i);

      // Temporarily set bottom margin to 0 to prevent PDFKit from triggering an auto page-break
      const oldBottomMargin = doc.page.margins.bottom;
      doc.page.margins.bottom = 0;

      const footerLineY = 804;
      const footerTextY = 811;

      // Divider Line
      doc
        .strokeColor(COLORS.border)
        .lineWidth(0.5)
        .moveTo(margin, footerLineY)
        .lineTo(margin + contentWidth, footerLineY)
        .stroke();

      // Left: Company Name
      doc
        .font('Helvetica-Bold')
        .fontSize(7.5)
        .fillColor(COLORS.secondary)
        .text('STOCK MANAGEMENT SYSTEM', margin, footerTextY, {
          width: 170,
          align: 'left',
          lineBreak: false,
        });

      // Center: Confidential Notice
      doc
        .font('Helvetica')
        .fontSize(7.5)
        .fillColor(COLORS.muted)
        .text('Confidential • Automated Business Report', margin + 170, footerTextY, {
          width: contentWidth - 340,
          align: 'center',
          lineBreak: false,
        });

      // Right: Page Numbers
      doc
        .font('Helvetica')
        .fontSize(7.5)
        .fillColor(COLORS.secondary)
        .text(`Page ${i + 1} of ${totalPages}`, margin + contentWidth - 160, footerTextY, {
          width: 160,
          align: 'right',
          lineBreak: false,
        });

      doc.page.margins.bottom = oldBottomMargin;
    }
  }

  // ==========================================================================
  // REUSABLE DRAWING HELPERS
  // ==========================================================================

  private drawSectionHeader(
    doc: InstanceType<typeof PDFDocument>,
    title: string,
    margin: number,
    y: number,
  ): void {
    // Accent Bar
    doc.rect(margin, y + 1, 3, 10).fillColor(COLORS.accent).fill();

    // Section Title
    doc
      .font('Helvetica-Bold')
      .fontSize(9.5)
      .fillColor(COLORS.primary)
      .text(title, margin + 8, y, {
        characterSpacing: 0.5,
      });
  }

  private drawSummaryCard(
    doc: InstanceType<typeof PDFDocument>,
    x: number,
    y: number,
    width: number,
    height: number,
    label: string,
    value: string,
    valueColor: string,
  ): void {
    // Card Background & Border (rounded corners radius 6)
    doc.roundedRect(x, y, width, height, 6).fillColor(COLORS.white).fill();
    doc
      .roundedRect(x, y, width, height, 6)
      .strokeColor(COLORS.border)
      .lineWidth(0.5)
      .stroke();

    // Label
    doc
      .font('Helvetica-Bold')
      .fontSize(6.5)
      .fillColor(COLORS.muted)
      .text(label, x + 8, y + 8, {
        width: width - 16,
        ellipsis: true,
      });

    // Value
    doc
      .font('Helvetica-Bold')
      .fontSize(12)
      .fillColor(valueColor)
      .text(value, x + 8, y + 20, {
        width: width - 16,
        ellipsis: true,
      });
  }

  private drawMiniMetric(
    doc: InstanceType<typeof PDFDocument>,
    x: number,
    y: number,
    width: number,
    height: number,
    label: string,
    value: string,
    valueColor: string = COLORS.primary,
  ): void {
    doc.roundedRect(x, y, width, height, 6).fillColor(COLORS.white).fill();
    doc
      .roundedRect(x, y, width, height, 6)
      .strokeColor(COLORS.border)
      .lineWidth(0.5)
      .stroke();

    doc
      .font('Helvetica-Bold')
      .fontSize(6)
      .fillColor(COLORS.muted)
      .text(label, x + 6, y + 5, {
        width: width - 12,
        ellipsis: true,
      });

    doc
      .font('Helvetica-Bold')
      .fontSize(8.5)
      .fillColor(valueColor)
      .text(value, x + 6, y + 17, {
        width: width - 12,
        ellipsis: true,
      });
  }

  private drawAlertBanner(
    doc: InstanceType<typeof PDFDocument>,
    x: number,
    y: number,
    width: number,
    height: number,
    text: string,
    isAlert: boolean,
  ): void {
    const bg = isAlert ? COLORS.dangerBg : '#F0FDF4';
    const border = isAlert ? '#FECACA' : '#DCFCE7';
    const textColor = isAlert ? COLORS.dangerText : COLORS.successText;
    const accentColor = isAlert ? COLORS.danger : COLORS.success;

    doc.roundedRect(x, y, width, height, 6).fillColor(bg).fill();
    doc
      .roundedRect(x, y, width, height, 6)
      .strokeColor(border)
      .lineWidth(0.5)
      .stroke();

    // Subtle left accent bar with rounded pill ends
    doc
      .roundedRect(x + 2, y + 2, 3, height - 4, 1.5)
      .fillColor(accentColor)
      .fill();

    doc
      .font('Helvetica-Bold')
      .fontSize(7.5)
      .fillColor(textColor)
      .text(text, x + 12, y + 6.5, {
        width: width - 24,
        ellipsis: true,
      });
  }

  private drawTopRoundedRect(
    doc: InstanceType<typeof PDFDocument>,
    x: number,
    y: number,
    w: number,
    h: number,
    r: number,
  ): void {
    doc
      .moveTo(x + r, y)
      .lineTo(x + w - r, y)
      .quadraticCurveTo(x + w, y, x + w, y + r)
      .lineTo(x + w, y + h)
      .lineTo(x, y + h)
      .lineTo(x, y + r)
      .quadraticCurveTo(x, y, x + r, y)
      .closePath();
  }

  private drawTableHeader(
    doc: InstanceType<typeof PDFDocument>,
    cols: { label: string; width: number; align: 'left' | 'right' | 'center' }[],
    margin: number,
    y: number,
  ): number {
    const headerHeight = 17;
    const totalWidth = cols.reduce((sum, c) => sum + c.width, 0);

    // Top-rounded header background
    this.drawTopRoundedRect(doc, margin, y, totalWidth, headerHeight, 6);
    doc.fillColor('#F1F5F9').fill();

    // Divider line under header
    doc
      .strokeColor(COLORS.border)
      .lineWidth(0.5)
      .moveTo(margin, y + headerHeight)
      .lineTo(margin + totalWidth, y + headerHeight)
      .stroke();

    let cellX = margin + 4;
    for (const col of cols) {
      doc
        .font('Helvetica-Bold')
        .fontSize(7.5)
        .fillColor(COLORS.secondary)
        .text(col.label, cellX, y + 4.5, {
          width: col.width - 8,
          align: col.align,
        });
      cellX += col.width;
    }

    return y + headerHeight;
  }

  private drawEmptyStateBox(
    doc: InstanceType<typeof PDFDocument>,
    margin: number,
    y: number,
    contentWidth: number,
    text: string,
  ): number {
    const boxHeight = 24;
    doc
      .roundedRect(margin, y, contentWidth, boxHeight, 6)
      .fillColor(COLORS.white)
      .fill();
    doc
      .roundedRect(margin, y, contentWidth, boxHeight, 6)
      .strokeColor(COLORS.border)
      .lineWidth(0.5)
      .stroke();

    doc
      .font('Helvetica-Oblique')
      .fontSize(8)
      .fillColor(COLORS.muted)
      .text(text, margin + 12, y + 7.5, {
        width: contentWidth - 24,
      });

    return y + boxHeight;
  }

  private ensureSpace(
    doc: InstanceType<typeof PDFDocument>,
    currentY: number,
    neededSpace: number,
    margin: number,
    contentWidth: number,
  ): number {
    if (currentY + neededSpace > 780) {
      doc.addPage();
      return NEW_PAGE_TOP_PADDING;
    }
    return currentY;
  }

  // ==========================================================================
  // FORMATTING HELPERS
  // ==========================================================================

  private formatCurrency(amount: number): string {
    const isNegative = amount < 0;
    const formatted = Math.abs(amount).toLocaleString('en-US', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    });
    return isNegative ? `-$${formatted}` : `$${formatted}`;
  }

  private formatNumber(num: number): string {
    return (num || 0).toLocaleString('en-US');
  }

  private formatDate(date: Date): string {
    const d = new Date(date);
    return d.toLocaleDateString('en-US', {
      month: 'long',
      day: 'numeric',
      year: 'numeric',
    });
  }

  private formatTime(date: Date): string {
    const d = new Date(date);
    return d.toLocaleTimeString('en-US', {
      hour: '2-digit',
      minute: '2-digit',
      hour12: true,
    });
  }

  /**
   * Helper that ensures text fits exactly within maxWidth on a single line,
   * cleanly appending an ellipsis (...) if truncated.
   */
  private fitText(
    doc: InstanceType<typeof PDFDocument>,
    text: string,
    maxWidth: number,
  ): string {
    if (!text) return '';
    if (doc.widthOfString(text) <= maxWidth) return text;
    let truncated = text;
    while (
      truncated.length > 0 &&
      doc.widthOfString(truncated + '...') > maxWidth
    ) {
      truncated = truncated.slice(0, -1);
    }
    return truncated.length > 0 ? truncated + '...' : '';
  }
}

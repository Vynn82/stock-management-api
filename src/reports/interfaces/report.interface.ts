export interface ProductSalesSummary {
  productCode: string;
  productName: string;
  variantCode?: string | null;
  variantName?: string | null;
  quantitySold: number;
  costPrice: number;
  sellingPrice: number;
  totalCost: number;
  totalRevenue: number;
  profit: number;
  profitMargin: number;
}

export interface StockInSummaryItem {
  productCode: string;
  productName: string;
  variantCode?: string | null;
  variantName?: string | null;
  quantityReceived: number;
  unitCost: number;
  totalCost: number;
}

export interface StockInReport {
  totalUnitsReceived: number;
  totalTransactions: number;
  totalCost: number;
  items: StockInSummaryItem[];
}

export interface AdjustmentReasonGroup {
  reason: string;
  adjustmentType: 'INCREASE' | 'DECREASE';
  totalQuantity: number;
  totalValue: number;
  items: {
    productCode: string;
    productName: string;
    variantCode?: string | null;
    quantity: number;
    value: number;
  }[];
}

export interface StockAdjustmentReport {
  totalAdjustments: number;
  netQuantity: number;
  totalDecreaseQuantity: number;
  totalDecreaseValue: number;
  totalIncreaseQuantity: number;
  totalIncreaseValue: number;
  byReason: AdjustmentReasonGroup[];
}

export interface LowStockWarning {
  productCode: string;
  productName: string;
  variantCode?: string | null;
  currentStock: number;
  minimumStock: number;
}

export interface SalesReport {
  period: 'DAILY' | 'WEEKLY';
  title: string;
  startDate: Date;
  endDate: Date;

  // Sales (Stock Out)
  totalUnitsSold: number;
  totalTransactions: number;
  totalCost: number;
  totalRevenue: number;
  netProfit: number;
  profitMargin: number;
  products: ProductSalesSummary[];

  // Stock In
  stockIn: StockInReport;

  // Stock Adjustments (Reason breakdown e.g. broken, damaged, expired)
  stockAdjustment: StockAdjustmentReport;

  // Inventory & Health
  totalInventoryStock: number;
  lowStockWarnings: LowStockWarning[];
}

import { CustomerOrderStatus } from '../../customer-orders/enums/customer-order-status.enum';
import {
  DeliveryStatus,
  PaymentStatus,
} from '../../customer-orders/enums/customer-order-enums';
import { OrderSource } from '../../customer-orders/enums/order-source.enum';

export interface DashboardInventoryKpi {
  totalProducts: number;
  totalVariants: number;
  totalStockQuantity: number;
  totalStockValue: number;
  lowStockCount: number;
  outOfStockCount: number;
  totalWarehouses: number;
}

export interface DashboardOrdersKpi {
  totalOrders: number;
  pendingOrders: number;
  waitingStockOrders: number;
  waitingCustomerOrders: number;
  confirmedOrders: number;
  deliveredOrders: number;
  cancelledOrders: number;
  rejectedOrders: number;
  todayOrders: number;
  thisWeekOrders: number;
  thisMonthOrders: number;
}

export interface DashboardRevenueKpi {
  totalRevenue: number;
  todayRevenue: number;
  thisWeekRevenue: number;
  thisMonthRevenue: number;
  paidRevenue: number;
  unpaidRevenue: number;
}

export interface DashboardCustomersKpi {
  totalCustomers: number;
  activeCustomers: number;
  newCustomersToday: number;
  newCustomersThisWeek: number;
}

export interface DashboardStaffKpi {
  totalStaff: number;
  activeStaff: number;
}

export interface DashboardRequestsKpi {
  pendingRequests: number;
  pendingStockIn: number;
  pendingStockOut: number;
  pendingTransfer: number;
}

export interface DashboardKpis {
  inventory: DashboardInventoryKpi;
  orders: DashboardOrdersKpi;
  revenue: DashboardRevenueKpi;
  customers: DashboardCustomersKpi;
  staff: DashboardStaffKpi;
  requests: DashboardRequestsKpi;
}

export interface DailyTrendItem {
  date: string;
  ordersCount: number;
  revenue: number;
  itemsSold: number;
}

export interface OrderStatusBreakdown {
  status: CustomerOrderStatus;
  count: number;
  percentage: number;
}

export interface OrderSourceBreakdown {
  source: string;
  count: number;
  percentage: number;
}

export interface TopProductItem {
  productId: string;
  productCode: string;
  productName: string;
  image: string | null;
  categoryName: string | null;
  unitsSold: number;
  revenue: number;
}

export interface LowStockAlertItem {
  productId: string;
  productCode: string;
  productName: string;
  categoryName: string | null;
  currentStock: number;
  minimumStock: number;
  status: 'OUT_OF_STOCK' | 'LOW_STOCK';
}

export interface RecentOrderItem {
  id: string;
  orderNo: string;
  customer: {
    id: string;
    companyName: string | null;
    contactName: string | null;
    phone: string | null;
  };
  totalAmount: number;
  status: CustomerOrderStatus;
  deliveryStatus: DeliveryStatus;
  paymentStatus: PaymentStatus;
  source: OrderSource;
  itemCount: number;
  createdAt: Date;
}

export interface RecentAdjustmentItem {
  id: string;
  productCode: string;
  productName: string;
  adjustmentType: string;
  quantity: number;
  reason: string;
  createdAt: Date;
}

export interface DashboardSummaryResponse {
  generatedAt: string;
  kpis: DashboardKpis;
  salesTrend: DailyTrendItem[];
  ordersByStatus: OrderStatusBreakdown[];
  ordersBySource: OrderSourceBreakdown[];
  topProducts: TopProductItem[];
  lowStockAlerts: LowStockAlertItem[];
  recentOrders: RecentOrderItem[];
  recentAdjustments: RecentAdjustmentItem[];
}

/**
 * Order Management System Types
 */

export enum OrderStatus {
  PENDING = 'pending',
  CONFIRMED = 'confirmed',
  PAID = 'paid',
  PROCESSING = 'processing',
  SHIPPED = 'shipped',
  DELIVERED = 'delivered',
  CANCELLED = 'cancelled',
  REFUNDED = 'refunded',
}

export enum PaymentStatus {
  PENDING = 'pending',
  PROCESSING = 'processing',
  COMPLETED = 'completed',
  FAILED = 'failed',
  REFUNDED = 'refunded',
  PARTIALLY_REFUNDED = 'partially_refunded',
}

export interface Order {
  id: string;
  orderNumber: string;
  userId: string;
  subtotal: number;
  tax: number;
  shippingCost: number;
  discount: number;
  total: number;
  totalAmount: number; // Alias for total
  status: OrderStatus;
  paymentMethod: string;
  paymentStatus: PaymentStatus;
  paidAt?: string;
  shippingMethod: string;
  estimatedDeliveryDate?: string;
  deliveredAt?: string;
  customerNotes?: string;
  adminNotes?: string;
  trackingNumber?: string;
  createdAt: string;
  updatedAt: string;
  cancelledAt?: string;
  items?: OrderItem[];
  user?: {
    id: string;
    username: string;
    email: string;
  };
  // Customer information
  customerName?: string;
  customerEmail?: string;
  customerPhone?: string;
  // Shipping address
  shippingAddress?: {
    fullName: string;
    addressLine1: string;
    addressLine2?: string;
    city: string;
    state: string;
    postalCode: string;
    country: string;
    phone: string;
  };
}

export interface OrderItem {
  id: string;
  orderId: string;
  productId: string;
  productName: string;
  productSku: string;
  productImageUrl?: string;
  price: number;
  quantity: number;
  subtotal: number;
  discount: number;
  tax: number;
  total: number;
  status: string;
  createdAt: string;
  updatedAt: string;
}

export interface OrderListResponse {
  items: Order[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
    hasNext: boolean;
    hasPrev: boolean;
  };
}

export interface OrderAnalytics {
  totalOrders: number;
  totalRevenue: number;
  averageOrderValue: number;
  ordersByStatus: Record<string, number>;
  ordersByPaymentStatus: Record<string, number>;
  revenueByDate: Array<{
    date: string;
    revenue: number;
    orderCount: number;
  }>;
  topProducts: Array<{
    productId: string;
    productName: string;
    quantity: number;
    revenue: number;
  }>;
}

export interface OrderQueryParams {
  page?: number;
  limit?: number;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
  status?: OrderStatus;
  paymentStatus?: PaymentStatus;
  userId?: string;
  orderNumber?: string;
  startDate?: string;
  endDate?: string;
  search?: string;
}

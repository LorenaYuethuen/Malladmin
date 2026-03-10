/**
 * Order types and interfaces
 */

export interface Order {
  id: string;
  orderNumber: string;
  userId: string;
  
  // Pricing
  subtotal: number;
  tax: number;
  shippingCost: number;
  discount: number;
  total: number;
  
  // Status
  status: OrderStatus;
  paymentMethod: string;
  paymentStatus: PaymentStatus;
  paidAt?: Date;
  
  // Shipping
  shippingMethod: string;
  estimatedDeliveryDate?: Date;
  deliveredAt?: Date;
  
  // Notes
  customerNotes?: string;
  adminNotes?: string;
  
  // Timestamps
  createdAt: Date;
  updatedAt: Date;
  cancelledAt?: Date;
  
  // Related data
  items?: OrderItem[];
  addresses?: OrderAddress[];
  user?: {
    id: string;
    username: string;
    email: string;
  };
}

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

export enum AddressType {
  BILLING = 'billing',
  SHIPPING = 'shipping',
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
  status: OrderItemStatus;
  createdAt: Date;
  updatedAt: Date;
}

export enum OrderItemStatus {
  PENDING = 'pending',
  CONFIRMED = 'confirmed',
  PROCESSING = 'processing',
  SHIPPED = 'shipped',
  DELIVERED = 'delivered',
  CANCELLED = 'cancelled',
  RETURNED = 'returned',
}

export interface OrderAddress {
  id: string;
  orderId: string;
  addressType: AddressType;
  recipientName: string;
  phone: string;
  email?: string;
  addressLine1: string;
  addressLine2?: string;
  city: string;
  state: string;
  postalCode: string;
  country: string;
  createdAt: Date;
}

// Request DTOs
export interface CreateOrderRequest {
  userId: string;
  items: Array<{
    productId: string;
    quantity: number;
    price?: number; // Optional, will be fetched from product if not provided
  }>;
  shippingAddress: {
    recipientName: string;
    phone: string;
    email?: string;
    addressLine1: string;
    addressLine2?: string;
    city: string;
    state: string;
    postalCode: string;
    country: string;
  };
  billingAddress?: {
    recipientName: string;
    phone: string;
    email?: string;
    addressLine1: string;
    addressLine2?: string;
    city: string;
    state: string;
    postalCode: string;
    country: string;
  };
  paymentMethod: string;
  shippingMethod: string;
  customerNotes?: string;
  couponCode?: string;
}

export interface UpdateOrderStatusRequest {
  status: OrderStatus;
  adminNotes?: string;
  trackingNumber?: string;
}

export interface CancelOrderRequest {
  reason: string;
  adminNotes?: string;
}

export interface OrderListFilters {
  status?: OrderStatus | OrderStatus[];
  paymentStatus?: PaymentStatus | PaymentStatus[];
  userId?: string;
  orderNumber?: string;
  startDate?: string;
  endDate?: string;
  minTotal?: number;
  maxTotal?: number;
  paymentMethod?: string;
  shippingMethod?: string;
  search?: string;
}

export interface OrderListQuery {
  page?: number;
  limit?: number;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
  filters?: OrderListFilters;
}

export interface OrderAnalytics {
  totalOrders: number;
  totalRevenue: number;
  averageOrderValue: number;
  ordersByStatus: Record<OrderStatus, number>;
  ordersByPaymentStatus: Record<PaymentStatus, number>;
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

// Order state machine validation
export const ORDER_STATUS_TRANSITIONS: Record<OrderStatus, OrderStatus[]> = {
  [OrderStatus.PENDING]: [OrderStatus.CONFIRMED, OrderStatus.CANCELLED],
  [OrderStatus.CONFIRMED]: [OrderStatus.PAID, OrderStatus.CANCELLED],
  [OrderStatus.PAID]: [OrderStatus.PROCESSING, OrderStatus.REFUNDED],
  [OrderStatus.PROCESSING]: [OrderStatus.SHIPPED, OrderStatus.CANCELLED],
  [OrderStatus.SHIPPED]: [OrderStatus.DELIVERED, OrderStatus.CANCELLED],
  [OrderStatus.DELIVERED]: [OrderStatus.REFUNDED],
  [OrderStatus.CANCELLED]: [],
  [OrderStatus.REFUNDED]: [],
};

/**
 * Validate if a status transition is allowed
 */
export function isValidStatusTransition(
  currentStatus: OrderStatus,
  newStatus: OrderStatus
): boolean {
  const allowedTransitions = ORDER_STATUS_TRANSITIONS[currentStatus];
  return allowedTransitions.includes(newStatus);
}

/**
 * Generate unique order number
 * Format: ORD-YYYYMMDD-XXXXXX (e.g., ORD-20240115-123456)
 */
export function generateOrderNumber(): string {
  const date = new Date();
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  const random = Math.floor(Math.random() * 1000000).toString().padStart(6, '0');
  return `ORD-${year}${month}${day}-${random}`;
}

// ============================================================================
// Shipping and Tracking Types
// ============================================================================

// Tracking Status Enum
export enum TrackingStatus {
  PENDING = 'pending',
  PICKED_UP = 'picked_up',
  IN_TRANSIT = 'in_transit',
  OUT_FOR_DELIVERY = 'out_for_delivery',
  DELIVERED = 'delivered',
  FAILED = 'failed',
  RETURNED = 'returned',
}
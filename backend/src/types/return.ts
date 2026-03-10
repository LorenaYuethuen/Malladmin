/**
 * Return Types
 * 
 * Type definitions for return and refund management functionality.
 */

/**
 * Return status enum
 */
export enum ReturnStatus {
  PENDING = 'pending',
  APPROVED = 'approved',
  REJECTED = 'rejected',
  REFUNDING = 'refunding',
  PROCESSING = 'processing',
  COMPLETED = 'completed',
  CANCELLED = 'cancelled',
}

/**
 * Valid status transitions for return requests.
 * Defines which statuses can transition to which other statuses.
 * Flow: pending → approved → refunding → completed
 *       pending → rejected
 */
export const VALID_STATUS_TRANSITIONS: Record<ReturnStatus, ReturnStatus[]> = {
  [ReturnStatus.PENDING]: [ReturnStatus.APPROVED, ReturnStatus.REJECTED, ReturnStatus.CANCELLED],
  [ReturnStatus.APPROVED]: [ReturnStatus.REFUNDING, ReturnStatus.CANCELLED],
  [ReturnStatus.REFUNDING]: [ReturnStatus.COMPLETED],
  [ReturnStatus.REJECTED]: [],
  [ReturnStatus.PROCESSING]: [ReturnStatus.COMPLETED],
  [ReturnStatus.COMPLETED]: [],
  [ReturnStatus.CANCELLED]: [],
};

/**
 * Refund status enum
 */
export enum RefundStatus {
  PENDING = 'pending',
  PROCESSING = 'processing',
  COMPLETED = 'completed',
  FAILED = 'failed',
}

/**
 * Return item status enum
 */
export enum ReturnItemStatus {
  PENDING = 'pending',
  APPROVED = 'approved',
  REJECTED = 'rejected',
  RECEIVED = 'received',
  REFUNDED = 'refunded',
}

/**
 * Return request interface
 */
export interface ReturnRequest {
  id: string;
  returnNumber: string;
  orderId: string;
  userId: string;
  status: ReturnStatus;
  reason: string;
  description: string | null;
  refundAmount: number;
  refundMethod: string | null;
  refundStatus: RefundStatus;
  adminNotes: string | null;
  requestedAt: Date;
  approvedAt: Date | null;
  rejectedAt: Date | null;
  completedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
  
  // Related data
  items?: ReturnItem[];
  order?: {
    id: string;
    orderNumber: string;
    total: number;
  };
}

/**
 * Return item interface
 */
export interface ReturnItem {
  id: string;
  returnRequestId: string;
  orderItemId: string;
  quantity: number;
  reason: string;
  condition: string | null;
  refundAmount: number;
  status: ReturnItemStatus;
  createdAt: Date;
  updatedAt: Date;
}

/**
 * Request DTO for creating return request
 */
export interface CreateReturnRequest {
  orderId: string;
  userId: string;
  items: Array<{
    orderItemId: string;
    quantity: number;
    reason: string;
    condition?: string;
  }>;
  reason: string;
  description?: string;
  refundMethod?: string;
}

/**
 * Request DTO for processing return (approve/reject/complete)
 */
export interface ProcessReturnRequest {
  action: 'approve' | 'reject' | 'complete';
  adminNotes?: string;
}

/**
 * Return list query parameters
 */
export interface ReturnListQuery {
  page?: number;
  limit?: number;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
  filters?: ReturnListFilters;
}

/**
 * Return list filters
 */
export interface ReturnListFilters {
  status?: ReturnStatus | ReturnStatus[];
  userId?: string;
  orderId?: string;
  returnNumber?: string;
  startDate?: string;
  endDate?: string;
}

/**
 * Return reason options (common reasons)
 */
export const RETURN_REASONS = {
  DEFECTIVE: '商品有质量问题',
  WRONG_ITEM: '收到错误商品',
  NOT_AS_DESCRIBED: '商品与描述不符',
  SIZE_ISSUE: '尺寸不合适',
  CHANGED_MIND: '不想要了',
  DAMAGED_SHIPPING: '运输过程中损坏',
  MISSING_PARTS: '商品缺少配件',
  OTHER: '其他原因',
} as const;

/**
 * Return condition options
 */
export const RETURN_CONDITIONS = {
  NEW: '全新未使用',
  OPENED: '已拆封未使用',
  USED: '已使用',
  DAMAGED: '已损坏',
} as const;

/**
 * Generate unique return number
 * Format: RET-YYYYMMDD-XXXXXX (e.g., RET-20240115-123456)
 */
export function generateReturnNumber(): string {
  const date = new Date();
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  const random = Math.floor(Math.random() * 1000000).toString().padStart(6, '0');
  return `RET-${year}${month}${day}-${random}`;
}

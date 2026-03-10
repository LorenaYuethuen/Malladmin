/**
 * Return Management System Types
 */

export enum ReturnStatus {
  PENDING = 'pending',
  APPROVED = 'approved',
  REJECTED = 'rejected',
  PROCESSING = 'processing',
  COMPLETED = 'completed',
  CANCELLED = 'cancelled',
}

export enum RefundStatus {
  PENDING = 'pending',
  PROCESSING = 'processing',
  COMPLETED = 'completed',
  FAILED = 'failed',
}

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
  requestedAt: string;
  approvedAt: string | null;
  rejectedAt: string | null;
  completedAt: string | null;
  createdAt: string;
  updatedAt: string;
  items?: ReturnItem[];
  order?: {
    id: string;
    orderNumber: string;
    total: number;
  };
}

export interface ReturnItem {
  id: string;
  returnRequestId: string;
  orderItemId: string;
  quantity: number;
  reason: string;
  condition: string | null;
  refundAmount: number;
  status: string;
  createdAt: string;
  updatedAt: string;
}

export interface ReturnListResponse {
  items: ReturnRequest[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
    hasNext: boolean;
    hasPrev: boolean;
  };
}

export interface ReturnQueryParams {
  page?: number;
  limit?: number;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
  status?: ReturnStatus;
  userId?: string;
  orderId?: string;
  returnNumber?: string;
  startDate?: string;
  endDate?: string;
}

export interface ProcessReturnRequest {
  action: 'approve' | 'reject' | 'complete';
  adminNotes?: string;
}

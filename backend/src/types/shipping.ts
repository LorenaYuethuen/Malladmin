/**
 * Shipping Types
 * 
 * Type definitions for shipping and logistics tracking functionality.
 * Supports multiple Chinese carriers and comprehensive tracking status management.
 */

/**
 * Tracking status enum
 */
export enum TrackingStatus {
  PENDING = 'pending',
  PICKED_UP = 'picked_up',
  IN_TRANSIT = 'in_transit',
  OUT_FOR_DELIVERY = 'out_for_delivery',
  DELIVERED = 'delivered',
  FAILED = 'failed',
  RETURNED = 'returned',
}

/**
 * Logistics provider enum - Chinese carriers
 */
export enum LogisticsProvider {
  SF_EXPRESS = '顺丰速运',
  YTO = '圆通速递',
  ZTO = '中通快递',
  YUNDA = '韵达快递',
  STO = '申通快递',
  EMS = '中国邮政EMS',
  JD_LOGISTICS = '京东物流',
  DEPPON = '德邦快递',
}

/**
 * Order tracking information
 */
export interface OrderTracking {
  id: string;
  orderId: string;
  trackingNumber: string;
  carrier: string;
  shippingMethod: string | null;
  status: TrackingStatus;
  shippedAt: Date | null;
  estimatedDeliveryDate: Date | null;
  deliveredAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

/**
 * Tracking update/history entry
 */
export interface TrackingUpdate {
  id: string;
  trackingId: string;
  status: string;
  location: string | null;
  description: string | null;
  occurredAt: Date;
  createdAt: Date;
}

/**
 * Request DTO for assigning tracking number
 */
export interface AssignTrackingRequest {
  orderId: string;
  trackingNumber: string;
  carrier: string;
  shippingMethod?: string;
  estimatedDeliveryDate?: string; // ISO date string
}

/**
 * Request DTO for updating tracking status
 */
export interface UpdateTrackingStatusRequest {
  status: TrackingStatus;
  location?: string;
  description?: string;
  occurredAt?: string; // ISO date string
}

/**
 * Response DTO for tracking information
 */
export interface TrackingResponse {
  tracking: OrderTracking;
  updates: TrackingUpdate[];
  order?: {
    id: string;
    orderNumber: string;
    status: string;
  };
}

/**
 * Request DTO for refreshing tracking from logistics provider
 */
export interface RefreshTrackingRequest {
  trackingNumber: string;
  carrier: string;
}

/**
 * Logistics API response format (mock)
 */
export interface LogisticsApiResponse {
  trackingNumber: string;
  carrier: string;
  status: TrackingStatus;
  updates: Array<{
    status: string;
    location: string;
    description: string;
    occurredAt: Date;
  }>;
  estimatedDeliveryDate?: Date;
  deliveredAt?: Date;
}

/**
 * Tracking query parameters
 */
export interface TrackingQueryParams {
  orderId?: string;
  trackingNumber?: string;
  carrier?: string;
  status?: TrackingStatus;
}

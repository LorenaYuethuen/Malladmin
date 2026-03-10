/**
 * Order Service
 * Handles all order-related API calls
 */

import { apiClient } from './api';
import type {
  Order,
  OrderListResponse,
  OrderQueryParams,
  OrderAnalytics,
} from '../types/order';

class OrderService {
  /**
   * Get orders list with filtering and pagination
   */
  async getOrders(params: OrderQueryParams = {}): Promise<OrderListResponse> {
    return apiClient.get<OrderListResponse>('/orders', params);
  }

  /**
   * Get a single order by ID
   */
  async getOrderById(id: string): Promise<Order> {
    return apiClient.get<Order>(`/orders/${id}`);
  }

  /**
   * Get order analytics
   */
  async getAnalytics(params?: {
    startDate?: string;
    endDate?: string;
    groupBy?: 'day' | 'week' | 'month';
  }): Promise<OrderAnalytics> {
    return apiClient.get<OrderAnalytics>('/orders/analytics', params);
  }

  /**
   * Update order status
   */
  async updateOrderStatus(
    id: string,
    data: {
      status: string;
      adminNotes?: string;
      trackingNumber?: string;
    }
  ): Promise<Order> {
    return apiClient.put<Order>(`/orders/${id}/status`, data);
  }

  /**
   * Cancel an order
   */
  async cancelOrder(
    id: string,
    data: {
      reason: string;
      adminNotes?: string;
    }
  ): Promise<Order> {
    return apiClient.post<Order>(`/orders/${id}/cancel`, data);
  }
}

export const orderService = new OrderService();

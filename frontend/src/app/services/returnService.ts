/**
 * Return Service
 * Handles all return-related API calls
 */

import { apiClient } from './api';
import type {
  ReturnRequest,
  ReturnListResponse,
  ReturnQueryParams,
  ProcessReturnRequest,
} from '../types/return';

class ReturnService {
  /**
   * Get return requests list with filtering and pagination
   */
  async getReturns(params: ReturnQueryParams = {}): Promise<ReturnListResponse> {
    return apiClient.get<ReturnListResponse>('/returns', params);
  }

  /**
   * Get a single return request by ID
   */
  async getReturnById(id: string): Promise<ReturnRequest> {
    return apiClient.get<ReturnRequest>(`/returns/${id}`);
  }

  /**
   * Process a return request (approve/reject/complete)
   */
  async processReturn(
    id: string,
    data: ProcessReturnRequest
  ): Promise<ReturnRequest> {
    return apiClient.put<ReturnRequest>(`/returns/${id}/process`, data);
  }

  /**
   * Cancel a return request
   */
  async cancelReturn(id: string): Promise<void> {
    return apiClient.delete<void>(`/returns/${id}`);
  }
}

export const returnService = new ReturnService();

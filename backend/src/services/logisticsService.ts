/**
 * Logistics Service
 * 
 * Mock logistics API integration for tracking packages with Chinese carriers.
 * In production, this would integrate with real logistics provider APIs.
 */

import {
  LogisticsApiResponse,
  TrackingStatus,
  LogisticsProvider,
} from '../types/shipping';
import logger from '../utils/logger';

class LogisticsService {
  /**
   * Get tracking information from logistics provider
   * Mock implementation - returns simulated tracking data
   */
  async getTrackingInfo(
    trackingNumber: string,
    carrier: string
  ): Promise<LogisticsApiResponse> {
    logger.info('Fetching tracking info from logistics provider', {
      trackingNumber,
      carrier,
    });

    // Simulate API call delay
    await this.simulateDelay(500);

    // Generate mock tracking data
    const mockData = this.generateMockTrackingData(trackingNumber, carrier);

    logger.debug('Tracking info retrieved', {
      trackingNumber,
      carrier,
      status: mockData.status,
      updatesCount: mockData.updates.length,
    });

    return mockData;
  }

  /**
   * Refresh tracking information from logistics provider
   * Mock implementation - returns updated tracking data
   */
  async refreshTracking(
    trackingNumber: string,
    carrier: string
  ): Promise<LogisticsApiResponse> {
    logger.info('Refreshing tracking info from logistics provider', {
      trackingNumber,
      carrier,
    });

    // Simulate API call delay
    await this.simulateDelay(300);

    // Generate mock tracking data with potential new updates
    const mockData = this.generateMockTrackingData(trackingNumber, carrier, true);

    logger.debug('Tracking info refreshed', {
      trackingNumber,
      carrier,
      status: mockData.status,
      updatesCount: mockData.updates.length,
    });

    return mockData;
  }

  /**
   * Validate tracking number format for specific carrier
   * Mock implementation - basic validation
   */
  validateTrackingNumber(trackingNumber: string, carrier: string): boolean {
    // Basic validation - in production, each carrier has specific formats
    if (!trackingNumber || trackingNumber.length < 5) {
      return false;
    }

    // Carrier-specific validation could be added here
    switch (carrier) {
      case LogisticsProvider.SF_EXPRESS:
        // SF Express tracking numbers typically start with SF
        return /^SF\d{12}$/.test(trackingNumber) || trackingNumber.length >= 10;
      case LogisticsProvider.YTO:
      case LogisticsProvider.ZTO:
      case LogisticsProvider.YUNDA:
      case LogisticsProvider.STO:
        // Most Chinese carriers use 12-13 digit numbers
        return /^\d{12,13}$/.test(trackingNumber) || trackingNumber.length >= 10;
      case LogisticsProvider.EMS:
        // EMS tracking numbers typically start with E and end with CN
        return /^E[A-Z]\d{9}CN$/.test(trackingNumber) || trackingNumber.length >= 10;
      default:
        return trackingNumber.length >= 5;
    }
  }

  /**
   * Get supported carriers list
   */
  getSupportedCarriers(): string[] {
    return Object.values(LogisticsProvider);
  }

  /**
   * Generate mock tracking data for testing
   * In production, this would be replaced with real API calls
   */
  private generateMockTrackingData(
    trackingNumber: string,
    carrier: string,
    isRefresh: boolean = false
  ): LogisticsApiResponse {
    // Determine status based on tracking number hash (for consistency)
    const hash = this.hashString(trackingNumber);
    const statusIndex = hash % 5;

    const statuses: TrackingStatus[] = [
      TrackingStatus.PICKED_UP,
      TrackingStatus.IN_TRANSIT,
      TrackingStatus.OUT_FOR_DELIVERY,
      TrackingStatus.DELIVERED,
      TrackingStatus.IN_TRANSIT,
    ];

    const status = statuses[statusIndex];

    // Generate tracking updates based on status
    const updates = this.generateMockUpdates(status, carrier, isRefresh);

    // Calculate estimated delivery date (3-5 days from now)
    const estimatedDeliveryDate = new Date();
    estimatedDeliveryDate.setDate(estimatedDeliveryDate.getDate() + 3 + (hash % 3));

    // Set delivered date if status is delivered
    const deliveredAt = status === TrackingStatus.DELIVERED
      ? new Date(Date.now() - (hash % 24) * 60 * 60 * 1000) // Random time in last 24 hours
      : undefined;

    return {
      trackingNumber,
      carrier,
      status,
      updates,
      estimatedDeliveryDate,
      deliveredAt,
    };
  }

  /**
   * Generate mock tracking updates
   */
  private generateMockUpdates(
    currentStatus: TrackingStatus,
    carrier: string,
    isRefresh: boolean
  ): Array<{
    status: string;
    location: string;
    description: string;
    occurredAt: Date;
  }> {
    const now = new Date();
    const updates: Array<{
      status: string;
      location: string;
      description: string;
      occurredAt: Date;
    }> = [];

    // Base updates that always exist
    const baseUpdates = [
      {
        status: 'pending',
        location: '深圳市',
        description: '快递已揽收',
        hoursAgo: 48,
      },
      {
        status: 'picked_up',
        location: '深圳转运中心',
        description: '快件已到达转运中心',
        hoursAgo: 42,
      },
    ];

    // Add base updates
    baseUpdates.forEach((update) => {
      const occurredAt = new Date(now.getTime() - update.hoursAgo * 60 * 60 * 1000);
      updates.push({
        status: update.status,
        location: update.location,
        description: `[${carrier}] ${update.description}`,
        occurredAt,
      });
    });

    // Add status-specific updates
    if (
      currentStatus === TrackingStatus.IN_TRANSIT ||
      currentStatus === TrackingStatus.OUT_FOR_DELIVERY ||
      currentStatus === TrackingStatus.DELIVERED
    ) {
      updates.push({
        status: 'in_transit',
        location: '广州转运中心',
        description: `[${carrier}] 快件正在运输途中`,
        occurredAt: new Date(now.getTime() - 24 * 60 * 60 * 1000),
      });

      updates.push({
        status: 'in_transit',
        location: '上海转运中心',
        description: `[${carrier}] 快件已到达目的地城市`,
        occurredAt: new Date(now.getTime() - 12 * 60 * 60 * 1000),
      });
    }

    if (
      currentStatus === TrackingStatus.OUT_FOR_DELIVERY ||
      currentStatus === TrackingStatus.DELIVERED
    ) {
      updates.push({
        status: 'out_for_delivery',
        location: '上海市浦东新区',
        description: `[${carrier}] 快件正在派送中，快递员：张师傅 (138****5678)`,
        occurredAt: new Date(now.getTime() - 2 * 60 * 60 * 1000),
      });
    }

    if (currentStatus === TrackingStatus.DELIVERED) {
      updates.push({
        status: 'delivered',
        location: '上海市浦东新区',
        description: `[${carrier}] 快件已签收，签收人：本人签收`,
        occurredAt: new Date(now.getTime() - 1 * 60 * 60 * 1000),
      });
    }

    // If this is a refresh, add a new update
    if (isRefresh && currentStatus !== TrackingStatus.DELIVERED) {
      updates.push({
        status: currentStatus,
        location: '运输途中',
        description: `[${carrier}] 快件运输中，请耐心等待`,
        occurredAt: now,
      });
    }

    return updates;
  }

  /**
   * Simple string hash function for consistent mock data
   */
  private hashString(str: string): number {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = (hash << 5) - hash + char;
      hash = hash & hash; // Convert to 32-bit integer
    }
    return Math.abs(hash);
  }

  /**
   * Simulate API call delay
   */
  private async simulateDelay(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}

export const logisticsService = new LogisticsService();
export default logisticsService;

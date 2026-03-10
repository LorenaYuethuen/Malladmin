/**
 * Inventory Types
 * 
 * Type definitions for inventory management functionality.
 */

/**
 * Product inventory interface
 */
export interface ProductInventory {
  id: string;
  productId: string;
  quantity: number;
  reservedQuantity: number;
  availableQuantity: number;
  lowStockThreshold: number;
  isInStock: boolean;
  isLowStock: boolean;
  lastRestockedAt: Date | null;
  updatedAt: Date;
}

/**
 * Stock reservation status
 */
export enum StockReservationStatus {
  RESERVED = 'reserved',
  CONFIRMED = 'confirmed',
  RELEASED = 'released',
}

/**
 * Stock reservation record
 */
export interface StockReservation {
  id: string;
  productId: string;
  orderId?: string;
  quantity: number;
  status: StockReservationStatus;
  expiresAt: Date;
  createdAt: Date;
  updatedAt: Date;
}

/**
 * Inventory reservation interface (legacy compat)
 */
export interface InventoryReservation {
  productId: string;
  quantity: number;
  orderId?: string;
  reservedAt: Date;
}

/**
 * Request DTO for reserving inventory
 */
export interface ReserveInventoryRequest {
  items: Array<{
    productId: string;
    quantity: number;
  }>;
  orderId?: string;
}

/**
 * Request DTO for deducting inventory
 */
export interface DeductInventoryRequest {
  items: Array<{
    productId: string;
    quantity: number;
  }>;
  orderId?: string;
}

/**
 * Request DTO for releasing inventory
 */
export interface ReleaseInventoryRequest {
  items: Array<{
    productId: string;
    quantity: number;
  }>;
  orderId?: string;
}

/**
 * Request DTO for updating inventory
 */
export interface UpdateInventoryRequest {
  quantity: number;
  lowStockThreshold?: number;
}

/**
 * Inventory operation result
 */
export interface InventoryOperationResult {
  success: boolean;
  productId: string;
  previousQuantity: number;
  newQuantity: number;
  previousReserved: number;
  newReserved: number;
  availableQuantity: number;
  message?: string;
}

/**
 * Bulk inventory operation result
 */
export interface BulkInventoryOperationResult {
  success: boolean;
  results: InventoryOperationResult[];
  failedItems?: Array<{
    productId: string;
    reason: string;
  }>;
}

/**
 * Inventory check result
 */
export interface InventoryCheckResult {
  productId: string;
  available: boolean;
  availableQuantity: number;
  requestedQuantity: number;
  isInStock: boolean;
  isLowStock: boolean;
}

/**
 * Low stock alert
 */
export interface LowStockAlert {
  productId: string;
  productName: string;
  availableQuantity: number;
  lowStockThreshold: number;
  isOutOfStock: boolean;
}

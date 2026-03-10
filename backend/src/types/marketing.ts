/**
 * Marketing System Types
 * Types for flash sales, coupons, recommendations, and advertisements
 */

// Flash Sales
export enum FlashSaleStatus {
  SCHEDULED = 'scheduled',
  ACTIVE = 'active',
  ENDED = 'ended',
  CANCELLED = 'cancelled',
}

export enum DiscountType {
  PERCENTAGE = 'percentage',
  FIXED = 'fixed',
}

export interface FlashSale {
  id: string;
  name: string;
  description?: string;
  startTime: Date;
  endTime: Date;
  status: FlashSaleStatus;
  discountType: DiscountType;
  discountValue: number;
  maxQuantity?: number;
  soldQuantity: number;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
  products?: FlashSaleProduct[];
}

export interface FlashSaleProduct {
  id: string;
  flashSaleId: string;
  productId: string;
  originalPrice: number;
  salePrice: number;
  stockLimit?: number;
  soldCount: number;
  createdAt: Date;
  product?: {
    id: string;
    name: string;
    sku: string;
    imageUrl?: string;
  };
}

// Coupons
export enum CouponType {
  PERCENTAGE = 'percentage',
  FIXED = 'fixed',
  FREE_SHIPPING = 'free_shipping',
}

export interface Coupon {
  id: string;
  code: string;
  name: string;
  description?: string;
  type: CouponType;
  discountValue?: number;
  minPurchaseAmount: number;
  maxDiscountAmount?: number;
  usageLimit?: number;
  usedCount: number;
  perUserLimit: number;
  startDate: Date;
  endDate: Date;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface CouponUsage {
  id: string;
  couponId: string;
  userId: string;
  orderId?: string;
  discountAmount: number;
  usedAt: Date;
  coupon?: Coupon;
  user?: {
    id: string;
    email: string;
    name?: string;
  };
}

// Recommendations
export enum RecommendationType {
  BANNER = 'banner',
  FEATURED = 'featured',
  NEW_ARRIVAL = 'new_arrival',
  BEST_SELLER = 'best_seller',
  HOT_DEAL = 'hot_deal',
}

export enum RecommendationPosition {
  HOME_TOP = 'home_top',
  HOME_MIDDLE = 'home_middle',
  HOME_BOTTOM = 'home_bottom',
  CATEGORY_TOP = 'category_top',
  PRODUCT_DETAIL = 'product_detail',
  CART = 'cart',
}

export interface Recommendation {
  id: string;
  title: string;
  description?: string;
  type: RecommendationType;
  position: RecommendationPosition;
  priority: number;
  linkUrl?: string;
  imageUrl?: string;
  startDate?: Date;
  endDate?: Date;
  isActive: boolean;
  clickCount: number;
  createdAt: Date;
  updatedAt: Date;
  products?: RecommendationProduct[];
}

export interface RecommendationProduct {
  id: string;
  recommendationId: string;
  productId: string;
  sortOrder: number;
  createdAt: Date;
  product?: {
    id: string;
    name: string;
    price: number;
    imageUrl?: string;
  };
}

// Advertisements
export enum AdvertisementPosition {
  TOP_BANNER = 'top_banner',
  SIDEBAR = 'sidebar',
  POPUP = 'popup',
  FOOTER = 'footer',
  CATEGORY_BANNER = 'category_banner',
}

export enum AdvertisementType {
  IMAGE = 'image',
  VIDEO = 'video',
  HTML = 'html',
}

export interface Advertisement {
  id: string;
  title: string;
  description?: string;
  imageUrl: string;
  linkUrl?: string;
  position: AdvertisementPosition;
  type: AdvertisementType;
  startDate: Date;
  endDate: Date;
  priority: number;
  isActive: boolean;
  clickCount: number;
  viewCount: number;
  createdAt: Date;
  updatedAt: Date;
}

// Request/Response Types
export interface CreateFlashSaleRequest {
  name: string;
  description?: string;
  startTime: string;
  endTime: string;
  discountType: DiscountType;
  discountValue: number;
  maxQuantity?: number;
  productIds?: string[];
}

export interface UpdateFlashSaleRequest extends Partial<CreateFlashSaleRequest> {
  status?: FlashSaleStatus;
  isActive?: boolean;
}

export interface CreateCouponRequest {
  code: string;
  name: string;
  description?: string;
  type: CouponType;
  discountValue?: number;
  minPurchaseAmount?: number;
  maxDiscountAmount?: number;
  usageLimit?: number;
  perUserLimit?: number;
  startDate: string;
  endDate: string;
}

export interface UpdateCouponRequest extends Partial<CreateCouponRequest> {
  isActive?: boolean;
}

export interface ValidateCouponRequest {
  code: string;
  userId: string;
  orderAmount: number;
}

export interface ValidateCouponResponse {
  valid: boolean;
  coupon?: Coupon;
  discountAmount?: number;
  message?: string;
}

export interface CreateRecommendationRequest {
  title: string;
  description?: string;
  type: RecommendationType;
  position: RecommendationPosition;
  priority?: number;
  linkUrl?: string;
  imageUrl?: string;
  startDate?: string;
  endDate?: string;
  productIds?: string[];
}

export interface UpdateRecommendationRequest extends Partial<CreateRecommendationRequest> {
  isActive?: boolean;
}

export interface CreateAdvertisementRequest {
  title: string;
  description?: string;
  imageUrl: string;
  linkUrl?: string;
  position: AdvertisementPosition;
  type?: AdvertisementType;
  startDate: string;
  endDate: string;
  priority?: number;
}

export interface UpdateAdvertisementRequest extends Partial<CreateAdvertisementRequest> {
  isActive?: boolean;
}

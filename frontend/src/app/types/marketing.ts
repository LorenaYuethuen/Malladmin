/**
 * Marketing System Types
 * 营销系统类型定义
 */

// Flash Sales - 秒杀活动
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
  startTime: string;
  endTime: string;
  status: FlashSaleStatus;
  discountType: DiscountType;
  discountValue: number;
  maxQuantity?: number;
  soldQuantity: number;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
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
  createdAt: string;
  product?: {
    id: string;
    name: string;
    sku: string;
    imageUrl?: string;
  };
}

// Coupons - 优惠券
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
  startDate: string;
  endDate: string;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

// Recommendations - 推荐位
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
  startDate?: string;
  endDate?: string;
  isActive: boolean;
  clickCount: number;
  createdAt: string;
  updatedAt: string;
  products?: RecommendationProduct[];
}

export interface RecommendationProduct {
  id: string;
  recommendationId: string;
  productId: string;
  sortOrder: number;
  createdAt: string;
  product?: {
    id: string;
    name: string;
    price: number;
    imageUrl?: string;
  };
}

// Advertisements - 广告
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
  startDate: string;
  endDate: string;
  priority: number;
  isActive: boolean;
  clickCount: number;
  viewCount: number;
  createdAt: string;
  updatedAt: string;
}

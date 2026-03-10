/**
 * Product types and interfaces
 */

export interface Product {
  id: string;
  name: string;
  slug: string;
  sku: string;
  barcode?: string;
  description?: string;
  shortDescription?: string;
  
  // Pricing
  price: number;
  salePrice?: number;
  costPrice?: number;
  
  // Relationships
  categoryId?: string;
  brandId?: string;
  category?: Category;
  brand?: Brand;
  
  // Status
  status: ProductStatus;
  visibility: ProductVisibility;
  productType: ProductType;
  
  // Shipping
  weight?: number;
  length?: number;
  width?: number;
  height?: number;
  
  // Flags
  isFeatured: boolean;
  isNew: boolean;
  isOnSale: boolean;
  allowBackorder: boolean;
  trackInventory: boolean;
  
  // Metrics
  ratingAverage: number;
  ratingCount: number;
  reviewCount: number;
  viewCount: number;
  salesCount: number;
  
  // Timestamps
  publishedAt?: Date;
  createdAt: Date;
  updatedAt: Date;
  createdBy?: string;
  updatedBy?: string;
  
  // Related data
  images?: ProductImage[];
  attributes?: ProductAttribute[];
  inventory?: ProductInventory;
  seo?: ProductSEO;
}

export enum ProductStatus {
  DRAFT = 'draft',
  ACTIVE = 'active',
  INACTIVE = 'inactive',
  ARCHIVED = 'archived',
}

export enum ProductVisibility {
  PUBLIC = 'public',
  PRIVATE = 'private',
  HIDDEN = 'hidden',
}

export enum ProductType {
  SIMPLE = 'simple',
  VARIABLE = 'variable',
  GROUPED = 'grouped',
  VIRTUAL = 'virtual',
  DOWNLOADABLE = 'downloadable',
}

export interface Category {
  id: string;
  name: string;
  slug: string;
  description?: string;
  parentId?: string;
  path?: string;
  level: number;
  sortOrder: number;
  imageUrl?: string;
  icon?: string;
  isActive: boolean;
  metaTitle?: string;
  metaDescription?: string;
  metaKeywords?: string;
  createdAt: Date;
  updatedAt: Date;
  children?: Category[];
}

export interface Brand {
  id: string;
  name: string;
  slug: string;
  description?: string;
  logoUrl?: string;
  websiteUrl?: string;
  isActive: boolean;
  sortOrder: number;
  metaTitle?: string;
  metaDescription?: string;
  metaKeywords?: string;
  createdAt: Date;
  updatedAt: Date;
  productCount?: number;
}

export interface Attribute {
  id: string;
  name: string;
  slug: string;
  type: AttributeType;
  options?: AttributeOption[];
  isRequired: boolean;
  isFilterable: boolean;
  isVisible: boolean;
  sortOrder: number;
  description?: string;
  createdAt: Date;
  updatedAt: Date;
}

export enum AttributeType {
  TEXT = 'text',
  SELECT = 'select',
  MULTISELECT = 'multiselect',
  COLOR = 'color',
  NUMBER = 'number',
  BOOLEAN = 'boolean',
}

export interface AttributeOption {
  value: string;
  label: string;
}

export interface ProductAttribute {
  id: string;
  productId: string;
  attributeId: string;
  value: string;
  attribute?: Attribute;
  createdAt: Date;
}

export interface ProductImage {
  id: string;
  productId: string;
  url: string;
  altText?: string;
  title?: string;
  isPrimary: boolean;
  sortOrder: number;
  width?: number;
  height?: number;
  fileSize?: number;
  mimeType?: string;
  createdAt: Date;
}

export interface ProductInventory {
  id: string;
  productId: string;
  quantity: number;
  reservedQuantity: number;
  availableQuantity: number;
  lowStockThreshold: number;
  isInStock: boolean;
  isLowStock: boolean;
  lastRestockedAt?: Date;
  updatedAt: Date;
}

export interface ProductSEO {
  id: string;
  productId: string;
  metaTitle?: string;
  metaDescription?: string;
  metaKeywords?: string;
  ogTitle?: string;
  ogDescription?: string;
  ogImageUrl?: string;
  canonicalUrl?: string;
  robots?: string;
  structuredData?: any;
  createdAt: Date;
  updatedAt: Date;
}

// Request DTOs
export interface CreateProductRequest {
  name: string;
  slug?: string;
  sku: string;
  barcode?: string;
  description?: string;
  shortDescription?: string;
  price: number;
  salePrice?: number;
  costPrice?: number;
  categoryId?: string;
  brandId?: string;
  status?: ProductStatus;
  visibility?: ProductVisibility;
  productType?: ProductType;
  weight?: number;
  length?: number;
  width?: number;
  height?: number;
  isFeatured?: boolean;
  isNew?: boolean;
  allowBackorder?: boolean;
  trackInventory?: boolean;
  publishedAt?: string;
  images?: Array<{
    url: string;
    altText?: string;
    title?: string;
    isPrimary?: boolean;
    sortOrder?: number;
  }>;
  attributes?: Array<{
    attributeId: string;
    value: string;
  }>;
  inventory?: {
    quantity: number;
    lowStockThreshold?: number;
  };
  seo?: {
    metaTitle?: string;
    metaDescription?: string;
    metaKeywords?: string;
    ogTitle?: string;
    ogDescription?: string;
    ogImageUrl?: string;
  };
}

export interface UpdateProductRequest extends Partial<CreateProductRequest> {
  id: string;
}

export interface ProductListFilters {
  status?: ProductStatus | ProductStatus[];
  visibility?: ProductVisibility;
  categoryId?: string;
  brandId?: string;
  minPrice?: number;
  maxPrice?: number;
  isFeatured?: boolean;
  isNew?: boolean;
  isOnSale?: boolean;
  inStock?: boolean;
  search?: string;
}

export interface ProductListQuery {
  page?: number;
  limit?: number;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
  filters?: ProductListFilters;
}

export interface BulkUpdateStatusRequest {
  productIds: string[];
  status: ProductStatus;
}

export interface BulkUpdateCategoryRequest {
  productIds: string[];
  categoryId: string;
}

export interface ProductImageUploadRequest {
  productId: string;
  altText?: string;
  title?: string;
  isPrimary?: boolean;
  sortOrder?: number;
}

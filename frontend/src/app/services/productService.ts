import { apiClient } from './api';
import type {
  Product,
  ProductListResponse,
  ProductQueryParams,
  CreateProductData,
  UpdateProductData,
  Category,
  Brand,
} from '../types/product';

class ProductService {
  /**
   * Get products list with filters
   */
  async getProducts(params: ProductQueryParams = {}): Promise<ProductListResponse> {
    const response = await apiClient.get<ProductListResponse>('/products', { params });
    return response.data;
  }

  /**
   * Get product by ID
   */
  async getProductById(id: string): Promise<Product> {
    const response = await apiClient.get<Product>(`/products/${id}`);
    return response.data;
  }

  /**
   * Create new product
   */
  async createProduct(data: CreateProductData): Promise<Product> {
    const response = await apiClient.post<Product>('/products', data);
    return response.data;
  }

  /**
   * Update product
   */
  async updateProduct(id: string, data: Partial<UpdateProductData>): Promise<Product> {
    const response = await apiClient.put<Product>(`/products/${id}`, data);
    return response.data;
  }

  /**
   * Delete product
   */
  async deleteProduct(id: string): Promise<void> {
    await apiClient.delete(`/products/${id}`);
  }

  /**
   * Bulk update product status
   */
  async bulkUpdateStatus(productIds: string[], status: string): Promise<{ updatedCount: number }> {
    const response = await apiClient.post<{ updatedCount: number }>('/products/bulk-update-status', {
      productIds,
      status,
    });
    return response.data;
  }

  /**
   * Bulk update product category
   */
  async bulkUpdateCategory(productIds: string[], categoryId: string): Promise<{ updatedCount: number }> {
    const response = await apiClient.post<{ updatedCount: number }>('/products/bulk-update-category', {
      productIds,
      categoryId,
    });
    return response.data;
  }

  /**
   * Upload product image
   */
  async uploadImage(productId: string, file: File): Promise<{ url: string }> {
    const formData = new FormData();
    formData.append('image', file);
    
    const response = await apiClient.post<{ url: string }>(
      `/products/${productId}/images`,
      formData,
      {
        headers: {
          'Content-Type': 'multipart/form-data',
        },
      }
    );
    return response.data;
  }

  /**
   * Get categories
   */
  async getCategories(): Promise<Category[]> {
    const response = await apiClient.get<{ items: Category[] }>('/categories');
    return response.data.items;
  }

  /**
   * Get brands
   */
  async getBrands(): Promise<Brand[]> {
    const response = await apiClient.get<{ items: Brand[] }>('/brands');
    return response.data.items;
  }
}

export const productService = new ProductService();

/**
 * Marketing Service
 * 营销管理服务层 - 处理所有营销相关的 API 调用
 */

import api from './api';
import type {
  FlashSale,
  Coupon,
  Recommendation,
  Advertisement,
} from '../types/marketing';

// ==================== Flash Sales API ====================

export const flashSaleService = {
  // 获取秒杀活动列表
  getFlashSales: async (params?: {
    page?: number;
    limit?: number;
    status?: string;
  }) => {
    const response = await api.get('/flash-sales', { params });
    return response.data;
  },

  // 获取单个秒杀活动
  getFlashSaleById: async (id: string) => {
    const response = await api.get(`/flash-sales/${id}`);
    return response.data;
  },

  // 创建秒杀活动
  createFlashSale: async (data: Partial<FlashSale>) => {
    const response = await api.post('/flash-sales', data);
    return response.data;
  },

  // 更新秒杀活动
  updateFlashSale: async (id: string, data: Partial<FlashSale>) => {
    const response = await api.put(`/flash-sales/${id}`, data);
    return response.data;
  },

  // 删除秒杀活动
  deleteFlashSale: async (id: string) => {
    const response = await api.delete(`/flash-sales/${id}`);
    return response.data;
  },

  // 添加商品到秒杀活动
  addProduct: async (id: string, productData: any) => {
    const response = await api.post(`/flash-sales/${id}/products`, productData);
    return response.data;
  },

  // 从秒杀活动移除商品
  removeProduct: async (id: string, productId: string) => {
    const response = await api.delete(`/flash-sales/${id}/products/${productId}`);
    return response.data;
  },
};

// ==================== Coupons API ====================

export const couponService = {
  // 获取优惠券列表
  getCoupons: async (params?: {
    page?: number;
    limit?: number;
    type?: string;
    isActive?: boolean;
  }) => {
    const response = await api.get('/coupons', { params });
    return response.data;
  },

  // 获取单个优惠券
  getCouponById: async (id: string) => {
    const response = await api.get(`/coupons/${id}`);
    return response.data;
  },

  // 创建优惠券
  createCoupon: async (data: Partial<Coupon>) => {
    const response = await api.post('/coupons', data);
    return response.data;
  },

  // 更新优惠券
  updateCoupon: async (id: string, data: Partial<Coupon>) => {
    const response = await api.put(`/coupons/${id}`, data);
    return response.data;
  },

  // 删除优惠券
  deleteCoupon: async (id: string) => {
    const response = await api.delete(`/coupons/${id}`);
    return response.data;
  },

  // 验证优惠券
  validateCoupon: async (code: string, userId: string, orderAmount: number) => {
    const response = await api.post('/coupons/validate', {
      code,
      userId,
      orderAmount,
    });
    return response.data;
  },

  // 获取优惠券使用记录
  getCouponUsage: async (id: string) => {
    const response = await api.get(`/coupons/${id}/usage`);
    return response.data;
  },
};

// ==================== Recommendations API ====================

export const recommendationService = {
  // 获取推荐位列表
  getRecommendations: async (params?: {
    page?: number;
    limit?: number;
    type?: string;
    position?: string;
  }) => {
    const response = await api.get('/recommendations', { params });
    return response.data;
  },

  // 获取单个推荐位
  getRecommendationById: async (id: string) => {
    const response = await api.get(`/recommendations/${id}`);
    return response.data;
  },

  // 创建推荐位
  createRecommendation: async (data: Partial<Recommendation>) => {
    const response = await api.post('/recommendations', data);
    return response.data;
  },

  // 更新推荐位
  updateRecommendation: async (id: string, data: Partial<Recommendation>) => {
    const response = await api.put(`/recommendations/${id}`, data);
    return response.data;
  },

  // 删除推荐位
  deleteRecommendation: async (id: string) => {
    const response = await api.delete(`/recommendations/${id}`);
    return response.data;
  },
};

// ==================== Advertisements API ====================

export const advertisementService = {
  // 获取广告列表
  getAdvertisements: async (params?: {
    page?: number;
    limit?: number;
    position?: string;
    isActive?: boolean;
  }) => {
    const response = await api.get('/advertisements', { params });
    return response.data;
  },

  // 获取单个广告
  getAdvertisementById: async (id: string) => {
    const response = await api.get(`/advertisements/${id}`);
    return response.data;
  },

  // 创建广告
  createAdvertisement: async (data: Partial<Advertisement>) => {
    const response = await api.post('/advertisements', data);
    return response.data;
  },

  // 更新广告
  updateAdvertisement: async (id: string, data: Partial<Advertisement>) => {
    const response = await api.put(`/advertisements/${id}`, data);
    return response.data;
  },

  // 删除广告
  deleteAdvertisement: async (id: string) => {
    const response = await api.delete(`/advertisements/${id}`);
    return response.data;
  },

  // 增加广告浏览量
  incrementView: async (id: string) => {
    const response = await api.post(`/advertisements/${id}/view`);
    return response.data;
  },

  // 增加广告点击量
  incrementClick: async (id: string) => {
    const response = await api.post(`/advertisements/${id}/click`);
    return response.data;
  },
};

export default {
  flashSale: flashSaleService,
  coupon: couponService,
  recommendation: recommendationService,
  advertisement: advertisementService,
};

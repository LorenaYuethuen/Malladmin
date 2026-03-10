/**
 * Coupons Page - 优惠券管理页面
 */

import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { couponService } from '../services/marketingService';
import type { Coupon, CouponType } from '../types/marketing';

export default function Coupons() {
  const navigate = useNavigate();
  const [coupons, setCoupons] = useState<Coupon[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterType, setFilterType] = useState<CouponType | ''>('');
  const [filterActive, setFilterActive] = useState<boolean | ''>('');

  // 加载优惠券列表
  const loadCoupons = async () => {
    try {
      setLoading(true);
      const params: any = {};
      if (filterType) params.type = filterType;
      if (filterActive !== '') params.isActive = filterActive;
      
      const response = await couponService.getCoupons(params);
      setCoupons(response.data || []);
    } catch (error) {
      console.error('Failed to load coupons:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadCoupons();
  }, [filterType, filterActive]);

  // 删除优惠券
  const handleDelete = async (id: string) => {
    if (!confirm('确定要删除这个优惠券吗？')) return;
    
    try {
      await couponService.deleteCoupon(id);
      loadCoupons();
    } catch (error) {
      console.error('Failed to delete coupon:', error);
      alert('删除失败');
    }
  };

  // 过滤优惠券
  const filteredCoupons = coupons.filter(coupon =>
    coupon.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    coupon.code.toLowerCase().includes(searchTerm.toLowerCase())
  );

  // 优惠券类型标签
  const getTypeLabel = (type: CouponType) => {
    const labels = {
      percentage: '百分比折扣',
      fixed: '固定金额',
      free_shipping: '免运费',
    };
    return labels[type] || type;
  };

  // 优惠券类型颜色
  const getTypeColor = (type: CouponType) => {
    const colors = {
      percentage: 'bg-blue-100 text-blue-800',
      fixed: 'bg-green-100 text-green-800',
      free_shipping: 'bg-purple-100 text-purple-800',
    };
    return colors[type] || 'bg-gray-100 text-gray-800';
  };

  return (
    <div className="p-6">
      {/* 页面标题 */}
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">优惠券管理</h1>
        <p className="mt-1 text-sm text-gray-600">管理所有优惠券和促销代码</p>
      </div>

      {/* 搜索和筛选栏 */}
      <div className="mb-6 flex flex-wrap gap-4">
        <div className="flex-1 min-w-[200px]">
          <input
            type="text"
            placeholder="搜索优惠券名称或代码..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          />
        </div>

        <select
          value={filterType}
          onChange={(e) => setFilterType(e.target.value as CouponType | '')}
          className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
        >
          <option value="">所有类型</option>
          <option value="percentage">百分比折扣</option>
          <option value="fixed">固定金额</option>
          <option value="free_shipping">免运费</option>
        </select>

        <select
          value={filterActive === '' ? '' : filterActive ? 'true' : 'false'}
          onChange={(e) => setFilterActive(e.target.value === '' ? '' : e.target.value === 'true')}
          className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
        >
          <option value="">所有状态</option>
          <option value="true">启用</option>
          <option value="false">禁用</option>
        </select>

        <button
          onClick={() => navigate('/coupons/new')}
          className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
        >
          + 创建优惠券
        </button>
      </div>

      {/* 优惠券列表 */}
      {loading ? (
        <div className="text-center py-12">
          <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
          <p className="mt-2 text-gray-600">加载中...</p>
        </div>
      ) : filteredCoupons.length === 0 ? (
        <div className="text-center py-12 bg-gray-50 rounded-lg">
          <p className="text-gray-600">暂无优惠券</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredCoupons.map((coupon) => (
            <div
              key={coupon.id}
              className="bg-white rounded-lg shadow-md hover:shadow-lg transition-shadow p-6"
            >
              {/* 优惠券头部 */}
              <div className="flex items-start justify-between mb-4">
                <div className="flex-1">
                  <h3 className="text-lg font-semibold text-gray-900 mb-1">
                    {coupon.name}
                  </h3>
                  <div className="flex items-center gap-2">
                    <span className="text-2xl font-bold text-blue-600">
                      {coupon.code}
                    </span>
                    <span className={`px-2 py-1 rounded text-xs font-medium ${getTypeColor(coupon.type)}`}>
                      {getTypeLabel(coupon.type)}
                    </span>
                  </div>
                </div>
                <div className={`px-2 py-1 rounded text-xs font-medium ${
                  coupon.isActive ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-800'
                }`}>
                  {coupon.isActive ? '启用' : '禁用'}
                </div>
              </div>

              {/* 优惠券详情 */}
              <div className="space-y-2 text-sm text-gray-600 mb-4">
                {coupon.description && (
                  <p className="line-clamp-2">{coupon.description}</p>
                )}
                <div className="flex items-center justify-between">
                  <span>折扣:</span>
                  <span className="font-medium text-gray-900">
                    {coupon.type === 'percentage' 
                      ? `${coupon.discountValue}%` 
                      : coupon.type === 'fixed'
                      ? `¥${coupon.discountValue}`
                      : '免运费'}
                  </span>
                </div>
                {coupon.minPurchaseAmount > 0 && (
                  <div className="flex items-center justify-between">
                    <span>最低消费:</span>
                    <span className="font-medium text-gray-900">¥{coupon.minPurchaseAmount}</span>
                  </div>
                )}
                <div className="flex items-center justify-between">
                  <span>使用情况:</span>
                  <span className="font-medium text-gray-900">
                    {coupon.usedCount} / {coupon.usageLimit || '无限制'}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span>有效期:</span>
                  <span className="font-medium text-gray-900">
                    {new Date(coupon.startDate).toLocaleDateString()} - {new Date(coupon.endDate).toLocaleDateString()}
                  </span>
                </div>
              </div>

              {/* 操作按钮 */}
              <div className="flex gap-2 pt-4 border-t border-gray-200">
                <button
                  onClick={() => navigate(`/coupons/${coupon.id}`)}
                  className="flex-1 px-4 py-2 bg-blue-50 text-blue-600 rounded hover:bg-blue-100 transition-colors"
                >
                  查看详情
                </button>
                <button
                  onClick={() => navigate(`/coupons/${coupon.id}/edit`)}
                  className="flex-1 px-4 py-2 bg-gray-50 text-gray-600 rounded hover:bg-gray-100 transition-colors"
                >
                  编辑
                </button>
                <button
                  onClick={() => handleDelete(coupon.id)}
                  className="px-4 py-2 bg-red-50 text-red-600 rounded hover:bg-red-100 transition-colors"
                >
                  删除
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

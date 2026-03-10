/**
 * Flash Sales Page - 秒杀活动管理页面
 */

import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { flashSaleService } from '../services/marketingService';
import type { FlashSale, FlashSaleStatus } from '../types/marketing';

export default function FlashSales() {
  const navigate = useNavigate();
  const [flashSales, setFlashSales] = useState<FlashSale[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterStatus, setFilterStatus] = useState<FlashSaleStatus | ''>('');

  // 加载秒杀活动列表
  const loadFlashSales = async () => {
    try {
      setLoading(true);
      const params: any = {};
      if (filterStatus) params.status = filterStatus;
      
      const response = await flashSaleService.getFlashSales(params);
      setFlashSales(response.data || []);
    } catch (error) {
      console.error('Failed to load flash sales:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadFlashSales();
  }, [filterStatus]);

  // 删除秒杀活动
  const handleDelete = async (id: string) => {
    if (!confirm('确定要删除这个秒杀活动吗？')) return;
    
    try {
      await flashSaleService.deleteFlashSale(id);
      loadFlashSales();
    } catch (error) {
      console.error('Failed to delete flash sale:', error);
      alert('删除失败');
    }
  };

  // 过滤秒杀活动
  const filteredFlashSales = flashSales.filter(sale =>
    sale.name.toLowerCase().includes(searchTerm.toLowerCase())
  );

  // 状态标签
  const getStatusLabel = (status: FlashSaleStatus) => {
    const labels = {
      scheduled: '未开始',
      active: '进行中',
      ended: '已结束',
      cancelled: '已取消',
    };
    return labels[status] || status;
  };

  // 状态颜色
  const getStatusColor = (status: FlashSaleStatus) => {
    const colors = {
      scheduled: 'bg-yellow-100 text-yellow-800',
      active: 'bg-green-100 text-green-800',
      ended: 'bg-gray-100 text-gray-800',
      cancelled: 'bg-red-100 text-red-800',
    };
    return colors[status] || 'bg-gray-100 text-gray-800';
  };

  // 计算剩余时间
  const getTimeRemaining = (sale: FlashSale) => {
    const now = new Date().getTime();
    const start = new Date(sale.startTime).getTime();
    const end = new Date(sale.endTime).getTime();

    if (now < start) {
      const diff = start - now;
      const days = Math.floor(diff / (1000 * 60 * 60 * 24));
      const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
      return `${days}天${hours}小时后开始`;
    } else if (now >= start && now < end) {
      const diff = end - now;
      const hours = Math.floor(diff / (1000 * 60 * 60));
      const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
      return `剩余 ${hours}小时${minutes}分钟`;
    } else {
      return '已结束';
    }
  };

  return (
    <div className="p-6">
      {/* 页面标题 */}
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">秒杀活动管理</h1>
        <p className="mt-1 text-sm text-gray-600">管理限时秒杀活动和特价商品</p>
      </div>

      {/* 搜索和筛选栏 */}
      <div className="mb-6 flex flex-wrap gap-4">
        <div className="flex-1 min-w-[200px]">
          <input
            type="text"
            placeholder="搜索活动名称..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          />
        </div>

        <select
          value={filterStatus}
          onChange={(e) => setFilterStatus(e.target.value as FlashSaleStatus | '')}
          className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
        >
          <option value="">所有状态</option>
          <option value="scheduled">未开始</option>
          <option value="active">进行中</option>
          <option value="ended">已结束</option>
          <option value="cancelled">已取消</option>
        </select>

        <button
          onClick={() => navigate('/flash-sales/new')}
          className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
        >
          + 创建秒杀活动
        </button>
      </div>

      {/* 秒杀活动列表 */}
      {loading ? (
        <div className="text-center py-12">
          <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
          <p className="mt-2 text-gray-600">加载中...</p>
        </div>
      ) : filteredFlashSales.length === 0 ? (
        <div className="text-center py-12 bg-gray-50 rounded-lg">
          <p className="text-gray-600">暂无秒杀活动</p>
        </div>
      ) : (
        <div className="space-y-4">
          {filteredFlashSales.map((sale) => (
            <div
              key={sale.id}
              className="bg-white rounded-lg shadow-md hover:shadow-lg transition-shadow p-6"
            >
              <div className="flex items-start justify-between">
                {/* 左侧信息 */}
                <div className="flex-1">
                  <div className="flex items-center gap-3 mb-2">
                    <h3 className="text-xl font-semibold text-gray-900">
                      {sale.name}
                    </h3>
                    <span className={`px-3 py-1 rounded-full text-sm font-medium ${getStatusColor(sale.status)}`}>
                      {getStatusLabel(sale.status)}
                    </span>
                    {!sale.isActive && (
                      <span className="px-3 py-1 rounded-full text-sm font-medium bg-gray-100 text-gray-800">
                        已禁用
                      </span>
                    )}
                  </div>

                  {sale.description && (
                    <p className="text-gray-600 mb-4">{sale.description}</p>
                  )}

                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                    <div>
                      <span className="text-gray-500">折扣类型:</span>
                      <p className="font-medium text-gray-900">
                        {sale.discountType === 'percentage' ? '百分比折扣' : '固定金额'}
                      </p>
                    </div>
                    <div>
                      <span className="text-gray-500">折扣值:</span>
                      <p className="font-medium text-gray-900">
                        {sale.discountType === 'percentage' 
                          ? `${sale.discountValue}%` 
                          : `¥${sale.discountValue}`}
                      </p>
                    </div>
                    <div>
                      <span className="text-gray-500">销售情况:</span>
                      <p className="font-medium text-gray-900">
                        {sale.soldQuantity} / {sale.maxQuantity || '无限制'}
                      </p>
                    </div>
                    <div>
                      <span className="text-gray-500">时间状态:</span>
                      <p className="font-medium text-blue-600">
                        {getTimeRemaining(sale)}
                      </p>
                    </div>
                  </div>

                  <div className="mt-4 pt-4 border-t border-gray-200">
                    <div className="flex items-center gap-4 text-sm text-gray-600">
                      <span>开始时间: {new Date(sale.startTime).toLocaleString()}</span>
                      <span>结束时间: {new Date(sale.endTime).toLocaleString()}</span>
                    </div>
                  </div>
                </div>

                {/* 右侧操作按钮 */}
                <div className="flex flex-col gap-2 ml-6">
                  <button
                    onClick={() => navigate(`/flash-sales/${sale.id}`)}
                    className="px-4 py-2 bg-blue-50 text-blue-600 rounded hover:bg-blue-100 transition-colors whitespace-nowrap"
                  >
                    查看详情
                  </button>
                  <button
                    onClick={() => navigate(`/flash-sales/${sale.id}/edit`)}
                    className="px-4 py-2 bg-gray-50 text-gray-600 rounded hover:bg-gray-100 transition-colors whitespace-nowrap"
                  >
                    编辑
                  </button>
                  <button
                    onClick={() => handleDelete(sale.id)}
                    className="px-4 py-2 bg-red-50 text-red-600 rounded hover:bg-red-100 transition-colors whitespace-nowrap"
                  >
                    删除
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

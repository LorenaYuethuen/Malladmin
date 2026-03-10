/**
 * Recommendations Page - 推荐位管理页面
 */

import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { recommendationService } from '../services/marketingService';
import type { Recommendation, RecommendationType, RecommendationPosition } from '../types/marketing';

export default function Recommendations() {
  const navigate = useNavigate();
  const [recommendations, setRecommendations] = useState<Recommendation[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterType, setFilterType] = useState<RecommendationType | ''>('');
  const [filterPosition, setFilterPosition] = useState<RecommendationPosition | ''>('');

  // 加载推荐位列表
  const loadRecommendations = async () => {
    try {
      setLoading(true);
      const params: any = {};
      if (filterType) params.type = filterType;
      if (filterPosition) params.position = filterPosition;
      
      const response = await recommendationService.getRecommendations(params);
      setRecommendations(response.data || []);
    } catch (error) {
      console.error('Failed to load recommendations:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadRecommendations();
  }, [filterType, filterPosition]);

  // 删除推荐位
  const handleDelete = async (id: string) => {
    if (!confirm('确定要删除这个推荐位吗？')) return;
    
    try {
      await recommendationService.deleteRecommendation(id);
      loadRecommendations();
    } catch (error) {
      console.error('Failed to delete recommendation:', error);
      alert('删除失败');
    }
  };

  // 类型标签
  const getTypeLabel = (type: RecommendationType) => {
    const labels = {
      banner: '横幅广告',
      featured: '精选推荐',
      new_arrival: '新品上架',
      best_seller: '热销商品',
      hot_deal: '热门优惠',
    };
    return labels[type] || type;
  };

  // 位置标签
  const getPositionLabel = (position: RecommendationPosition) => {
    const labels = {
      home_top: '首页顶部',
      home_middle: '首页中部',
      home_bottom: '首页底部',
      category_top: '分类页顶部',
      product_detail: '商品详情页',
      cart: '购物车页',
    };
    return labels[position] || position;
  };

  // 类型颜色
  const getTypeColor = (type: RecommendationType) => {
    const colors = {
      banner: 'bg-purple-100 text-purple-800',
      featured: 'bg-blue-100 text-blue-800',
      new_arrival: 'bg-green-100 text-green-800',
      best_seller: 'bg-red-100 text-red-800',
      hot_deal: 'bg-orange-100 text-orange-800',
    };
    return colors[type] || 'bg-gray-100 text-gray-800';
  };

  return (
    <div className="p-6">
      {/* 页面标题 */}
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">推荐位管理</h1>
        <p className="mt-1 text-sm text-gray-600">管理首页和各页面的商品推荐位</p>
      </div>

      {/* 筛选栏 */}
      <div className="mb-6 flex flex-wrap gap-4">
        <select
          value={filterType}
          onChange={(e) => setFilterType(e.target.value as RecommendationType | '')}
          className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
        >
          <option value="">所有类型</option>
          <option value="banner">横幅广告</option>
          <option value="featured">精选推荐</option>
          <option value="new_arrival">新品上架</option>
          <option value="best_seller">热销商品</option>
          <option value="hot_deal">热门优惠</option>
        </select>

        <select
          value={filterPosition}
          onChange={(e) => setFilterPosition(e.target.value as RecommendationPosition | '')}
          className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
        >
          <option value="">所有位置</option>
          <option value="home_top">首页顶部</option>
          <option value="home_middle">首页中部</option>
          <option value="home_bottom">首页底部</option>
          <option value="category_top">分类页顶部</option>
          <option value="product_detail">商品详情页</option>
          <option value="cart">购物车页</option>
        </select>

        <button
          onClick={() => navigate('/recommendations/new')}
          className="ml-auto px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
        >
          + 创建推荐位
        </button>
      </div>

      {/* 推荐位列表 */}
      {loading ? (
        <div className="text-center py-12">
          <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
          <p className="mt-2 text-gray-600">加载中...</p>
        </div>
      ) : recommendations.length === 0 ? (
        <div className="text-center py-12 bg-gray-50 rounded-lg">
          <p className="text-gray-600">暂无推荐位</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {recommendations.map((rec) => (
            <div
              key={rec.id}
              className="bg-white rounded-lg shadow-md hover:shadow-lg transition-shadow overflow-hidden"
            >
              {/* 图片预览 */}
              {rec.imageUrl && (
                <div className="h-48 bg-gray-200 overflow-hidden">
                  <img
                    src={rec.imageUrl}
                    alt={rec.title}
                    className="w-full h-full object-cover"
                  />
                </div>
              )}

              <div className="p-6">
                {/* 标题和标签 */}
                <div className="flex items-start justify-between mb-3">
                  <div className="flex-1">
                    <h3 className="text-lg font-semibold text-gray-900 mb-2">
                      {rec.title}
                    </h3>
                    <div className="flex flex-wrap gap-2">
                      <span className={`px-2 py-1 rounded text-xs font-medium ${getTypeColor(rec.type)}`}>
                        {getTypeLabel(rec.type)}
                      </span>
                      <span className="px-2 py-1 rounded text-xs font-medium bg-gray-100 text-gray-800">
                        {getPositionLabel(rec.position)}
                      </span>
                      <span className={`px-2 py-1 rounded text-xs font-medium ${
                        rec.isActive ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-800'
                      }`}>
                        {rec.isActive ? '启用' : '禁用'}
                      </span>
                    </div>
                  </div>
                </div>

                {/* 描述 */}
                {rec.description && (
                  <p className="text-sm text-gray-600 mb-4 line-clamp-2">
                    {rec.description}
                  </p>
                )}

                {/* 详细信息 */}
                <div className="space-y-2 text-sm text-gray-600 mb-4">
                  <div className="flex items-center justify-between">
                    <span>优先级:</span>
                    <span className="font-medium text-gray-900">{rec.priority}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span>点击量:</span>
                    <span className="font-medium text-gray-900">{rec.clickCount}</span>
                  </div>
                  {rec.linkUrl && (
                    <div className="flex items-center justify-between">
                      <span>链接:</span>
                      <a
                        href={rec.linkUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-blue-600 hover:underline truncate max-w-[200px]"
                      >
                        {rec.linkUrl}
                      </a>
                    </div>
                  )}
                  {rec.startDate && rec.endDate && (
                    <div className="flex items-center justify-between">
                      <span>有效期:</span>
                      <span className="font-medium text-gray-900">
                        {new Date(rec.startDate).toLocaleDateString()} - {new Date(rec.endDate).toLocaleDateString()}
                      </span>
                    </div>
                  )}
                </div>

                {/* 操作按钮 */}
                <div className="flex gap-2 pt-4 border-t border-gray-200">
                  <button
                    onClick={() => navigate(`/recommendations/${rec.id}`)}
                    className="flex-1 px-4 py-2 bg-blue-50 text-blue-600 rounded hover:bg-blue-100 transition-colors"
                  >
                    查看详情
                  </button>
                  <button
                    onClick={() => navigate(`/recommendations/${rec.id}/edit`)}
                    className="flex-1 px-4 py-2 bg-gray-50 text-gray-600 rounded hover:bg-gray-100 transition-colors"
                  >
                    编辑
                  </button>
                  <button
                    onClick={() => handleDelete(rec.id)}
                    className="px-4 py-2 bg-red-50 text-red-600 rounded hover:bg-red-100 transition-colors"
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

/**
 * Advertisements Page - 广告管理页面
 */

import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { advertisementService } from '../services/marketingService';
import type { Advertisement, AdvertisementPosition } from '../types/marketing';

export default function Advertisements() {
  const navigate = useNavigate();
  const [advertisements, setAdvertisements] = useState<Advertisement[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterPosition, setFilterPosition] = useState<AdvertisementPosition | ''>('');
  const [filterActive, setFilterActive] = useState<boolean | ''>('');

  // 加载广告列表
  const loadAdvertisements = async () => {
    try {
      setLoading(true);
      const params: any = {};
      if (filterPosition) params.position = filterPosition;
      if (filterActive !== '') params.isActive = filterActive;
      
      const response = await advertisementService.getAdvertisements(params);
      setAdvertisements(response.data || []);
    } catch (error) {
      console.error('Failed to load advertisements:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadAdvertisements();
  }, [filterPosition, filterActive]);

  // 删除广告
  const handleDelete = async (id: string) => {
    if (!confirm('确定要删除这个广告吗？')) return;
    
    try {
      await advertisementService.deleteAdvertisement(id);
      loadAdvertisements();
    } catch (error) {
      console.error('Failed to delete advertisement:', error);
      alert('删除失败');
    }
  };

  // 位置标签
  const getPositionLabel = (position: AdvertisementPosition) => {
    const labels = {
      top_banner: '顶部横幅',
      sidebar: '侧边栏',
      popup: '弹窗',
      footer: '页脚',
      category_banner: '分类横幅',
    };
    return labels[position] || position;
  };

  // 位置颜色
  const getPositionColor = (position: AdvertisementPosition) => {
    const colors = {
      top_banner: 'bg-blue-100 text-blue-800',
      sidebar: 'bg-purple-100 text-purple-800',
      popup: 'bg-orange-100 text-orange-800',
      footer: 'bg-gray-100 text-gray-800',
      category_banner: 'bg-green-100 text-green-800',
    };
    return colors[position] || 'bg-gray-100 text-gray-800';
  };

  // 计算点击率
  const getClickRate = (ad: Advertisement) => {
    if (ad.viewCount === 0) return '0%';
    return ((ad.clickCount / ad.viewCount) * 100).toFixed(2) + '%';
  };

  return (
    <div className="p-6">
      {/* 页面标题 */}
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">广告管理</h1>
        <p className="mt-1 text-sm text-gray-600">管理网站各位置的广告内容</p>
      </div>

      {/* 筛选栏 */}
      <div className="mb-6 flex flex-wrap gap-4">
        <select
          value={filterPosition}
          onChange={(e) => setFilterPosition(e.target.value as AdvertisementPosition | '')}
          className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
        >
          <option value="">所有位置</option>
          <option value="top_banner">顶部横幅</option>
          <option value="sidebar">侧边栏</option>
          <option value="popup">弹窗</option>
          <option value="footer">页脚</option>
          <option value="category_banner">分类横幅</option>
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
          onClick={() => navigate('/advertisements/new')}
          className="ml-auto px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
        >
          + 创建广告
        </button>
      </div>

      {/* 广告列表 */}
      {loading ? (
        <div className="text-center py-12">
          <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
          <p className="mt-2 text-gray-600">加载中...</p>
        </div>
      ) : advertisements.length === 0 ? (
        <div className="text-center py-12 bg-gray-50 rounded-lg">
          <p className="text-gray-600">暂无广告</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-6">
          {advertisements.map((ad) => (
            <div
              key={ad.id}
              className="bg-white rounded-lg shadow-md hover:shadow-lg transition-shadow overflow-hidden"
            >
              {/* 广告图片 */}
              <div className="h-48 bg-gray-200 overflow-hidden">
                <img
                  src={ad.imageUrl}
                  alt={ad.title}
                  className="w-full h-full object-cover"
                />
              </div>

              <div className="p-6">
                {/* 标题和标签 */}
                <div className="flex items-start justify-between mb-3">
                  <div className="flex-1">
                    <h3 className="text-lg font-semibold text-gray-900 mb-2">
                      {ad.title}
                    </h3>
                    <div className="flex flex-wrap gap-2">
                      <span className={`px-2 py-1 rounded text-xs font-medium ${getPositionColor(ad.position)}`}>
                        {getPositionLabel(ad.position)}
                      </span>
                      <span className={`px-2 py-1 rounded text-xs font-medium ${
                        ad.isActive ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-800'
                      }`}>
                        {ad.isActive ? '启用' : '禁用'}
                      </span>
                      <span className="px-2 py-1 rounded text-xs font-medium bg-indigo-100 text-indigo-800">
                        {ad.type.toUpperCase()}
                      </span>
                    </div>
                  </div>
                </div>

                {/* 描述 */}
                {ad.description && (
                  <p className="text-sm text-gray-600 mb-4 line-clamp-2">
                    {ad.description}
                  </p>
                )}

                {/* 统计数据 */}
                <div className="grid grid-cols-3 gap-4 mb-4 p-4 bg-gray-50 rounded-lg">
                  <div className="text-center">
                    <p className="text-2xl font-bold text-blue-600">{ad.viewCount}</p>
                    <p className="text-xs text-gray-600">浏览量</p>
                  </div>
                  <div className="text-center">
                    <p className="text-2xl font-bold text-green-600">{ad.clickCount}</p>
                    <p className="text-xs text-gray-600">点击量</p>
                  </div>
                  <div className="text-center">
                    <p className="text-2xl font-bold text-purple-600">{getClickRate(ad)}</p>
                    <p className="text-xs text-gray-600">点击率</p>
                  </div>
                </div>

                {/* 详细信息 */}
                <div className="space-y-2 text-sm text-gray-600 mb-4">
                  <div className="flex items-center justify-between">
                    <span>优先级:</span>
                    <span className="font-medium text-gray-900">{ad.priority}</span>
                  </div>
                  {ad.linkUrl && (
                    <div className="flex items-center justify-between">
                      <span>链接:</span>
                      <a
                        href={ad.linkUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-blue-600 hover:underline truncate max-w-[150px]"
                      >
                        {ad.linkUrl}
                      </a>
                    </div>
                  )}
                  <div className="flex items-center justify-between">
                    <span>有效期:</span>
                    <span className="font-medium text-gray-900">
                      {new Date(ad.startDate).toLocaleDateString()} - {new Date(ad.endDate).toLocaleDateString()}
                    </span>
                  </div>
                </div>

                {/* 操作按钮 */}
                <div className="flex gap-2 pt-4 border-t border-gray-200">
                  <button
                    onClick={() => navigate(`/advertisements/${ad.id}`)}
                    className="flex-1 px-4 py-2 bg-blue-50 text-blue-600 rounded hover:bg-blue-100 transition-colors"
                  >
                    查看
                  </button>
                  <button
                    onClick={() => navigate(`/advertisements/${ad.id}/edit`)}
                    className="flex-1 px-4 py-2 bg-gray-50 text-gray-600 rounded hover:bg-gray-100 transition-colors"
                  >
                    编辑
                  </button>
                  <button
                    onClick={() => handleDelete(ad.id)}
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

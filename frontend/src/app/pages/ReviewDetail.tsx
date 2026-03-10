import { useState } from 'react';
import { useParams, useNavigate } from 'react-router';
import { ArrowLeft, Star, MessageSquare, Shield, CheckCircle, Trash2, Reply } from 'lucide-react';

export function ReviewDetail() {
  const { id } = useParams();
  const navigate = useNavigate();

  const review = {
    id: id || 'REV-2099',
    productName: '无线头戴式耳机',
    productId: 'PROD-001',
    user: 'Alice S.',
    rating: 5,
    date: '2023-10-24 14:30',
    content: '这款耳机音质非常棒，降噪效果超出预期。佩戴也很舒适，长时间使用不会夹耳朵。电池续航确实如宣传的那样长。强烈推荐购买！',
    status: '已发布',
    reply: '感谢您的好评！您的支持是我们前进的动力。',
  };

  return (
    <div className="space-y-6 max-w-4xl mx-auto pb-10">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div className="flex items-center gap-4">
          <button 
            onClick={() => navigate('/reviews')}
            className="p-2 hover:bg-gray-100 rounded-lg transition-colors text-gray-500"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div>
            <div className="flex items-center gap-3">
              <h1 className="text-2xl font-bold tracking-tight text-gray-900">评价详情</h1>
              <span className="px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-50 text-green-700 ring-1 ring-inset ring-green-600/20">
                {review.status}
              </span>
            </div>
            <p className="text-sm text-gray-500 mt-1">ID: {review.id} • {review.date}</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button className="flex items-center gap-2 px-4 py-2 border border-gray-300 bg-white rounded-lg text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors shadow-sm">
            <Trash2 className="w-4 h-4" />
            删除评价
          </button>
        </div>
      </div>

      <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-6 space-y-6">
        <div className="flex flex-col sm:flex-row gap-6 border-b border-gray-100 pb-6">
          <div className="w-24 h-24 bg-gray-100 rounded-lg flex items-center justify-center shrink-0">
             <span className="text-gray-400 text-sm">商品图</span>
          </div>
          <div>
            <h3 className="text-lg font-semibold text-gray-900">{review.productName}</h3>
            <p className="text-sm text-gray-500 mt-1">商品ID: {review.productId}</p>
            <div className="mt-3 flex items-center gap-1">
              {[1, 2, 3, 4, 5].map((star) => (
                <Star 
                  key={star} 
                  className={`w-5 h-5 ${star <= review.rating ? 'fill-yellow-400 text-yellow-400' : 'text-gray-300'}`} 
                />
              ))}
              <span className="ml-2 font-medium text-gray-900">{review.rating}.0</span>
            </div>
          </div>
        </div>

        <div className="space-y-4 pb-6 border-b border-gray-100">
          <div className="flex items-center gap-2">
             <div className="w-8 h-8 rounded-full bg-indigo-100 flex items-center justify-center text-indigo-700 font-bold text-sm">
               {review.user.charAt(0)}
             </div>
             <span className="font-medium text-gray-900">{review.user}</span>
          </div>
          <p className="text-gray-700 leading-relaxed bg-gray-50 p-4 rounded-lg">
            "{review.content}"
          </p>
        </div>

        <div>
          <h4 className="font-medium text-gray-900 mb-4 flex items-center gap-2">
            <Reply className="w-5 h-5 text-gray-400" />
            回复记录
          </h4>
          {review.reply ? (
            <div className="bg-indigo-50 border border-indigo-100 p-4 rounded-lg">
              <div className="flex items-center gap-2 mb-2">
                <Shield className="w-4 h-4 text-indigo-600" />
                <span className="font-medium text-indigo-900 text-sm">官方客服</span>
              </div>
              <p className="text-sm text-indigo-800">{review.reply}</p>
            </div>
          ) : (
            <div className="space-y-3">
              <textarea 
                className="w-full border border-gray-300 rounded-lg p-3 text-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500" 
                rows={4} 
                placeholder="在此输入回复内容..."
              />
              <button className="bg-indigo-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-indigo-700 transition-colors shadow-sm">
                发送回复
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

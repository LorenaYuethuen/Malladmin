import { Star, ThumbsUp, MessageSquare, Search, Trash2 } from 'lucide-react';

export function Reviews() {
  const reviews = [
    { id: 1, product: 'Wireless Headphones', user: 'johndoe88', rating: 5, comment: 'Amazing sound quality and very comfortable!', date: 'Oct 24, 2023', status: 'Approved' },
    { id: 2, product: 'Organic Cotton T-Shirt', user: 'sarahm', rating: 4, comment: 'Nice fit, but the color is slightly different than the picture.', date: 'Oct 23, 2023', status: 'Approved' },
    { id: 3, product: 'Smart Watch Series 8', user: 'techgeek', rating: 2, comment: 'Battery life is terrible. Barely lasts a day.', date: 'Oct 21, 2023', status: 'Pending Review' },
  ];

  const renderStars = (rating: number) => {
    return Array(5).fill(0).map((_, i) => (
      <Star key={i} className={`w-4 h-4 ${i < rating ? 'text-yellow-400 fill-yellow-400' : 'text-gray-300'}`} />
    ));
  };

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-gray-900">Reviews (RMS)</h1>
          <p className="text-sm text-gray-500 mt-1">Manage product reviews, moderation, and customer feedback.</p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-white p-5 rounded-xl border border-gray-200 shadow-sm flex items-center gap-4">
          <div className="w-12 h-12 rounded-full bg-yellow-50 flex items-center justify-center text-yellow-600">
            <Star className="w-6 h-6" />
          </div>
          <div>
            <h3 className="text-2xl font-bold text-gray-900">4.8</h3>
            <p className="text-sm text-gray-500">Average Store Rating</p>
          </div>
        </div>
        <div className="bg-white p-5 rounded-xl border border-gray-200 shadow-sm flex items-center gap-4">
          <div className="w-12 h-12 rounded-full bg-blue-50 flex items-center justify-center text-blue-600">
            <MessageSquare className="w-6 h-6" />
          </div>
          <div>
            <h3 className="text-2xl font-bold text-gray-900">12,402</h3>
            <p className="text-sm text-gray-500">Total Reviews</p>
          </div>
        </div>
        <div className="bg-white p-5 rounded-xl border border-gray-200 shadow-sm flex items-center gap-4">
          <div className="w-12 h-12 rounded-full bg-orange-50 flex items-center justify-center text-orange-600">
            <ThumbsUp className="w-6 h-6" />
          </div>
          <div>
            <h3 className="text-2xl font-bold text-gray-900">24</h3>
            <p className="text-sm text-gray-500">Pending Moderation</p>
          </div>
        </div>
      </div>

      <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden mt-6">
        <div className="p-4 border-b border-gray-200 flex flex-wrap gap-4 justify-between items-center bg-gray-50/50">
          <div className="relative w-full sm:w-80">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <input 
              type="text" 
              placeholder="Search reviews by keyword, product, or user..." 
              className="w-full pl-9 pr-4 py-2 bg-white border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
          </div>
          <select className="border border-gray-300 rounded-lg text-sm py-2 px-3 bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500">
            <option>All Status</option>
            <option>Pending</option>
            <option>Approved</option>
            <option>Rejected</option>
          </select>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm whitespace-nowrap">
            <thead className="bg-gray-50 text-gray-500 border-b border-gray-200">
              <tr>
                <th className="px-6 py-3 font-medium">Review & Rating</th>
                <th className="px-6 py-3 font-medium">Product / User</th>
                <th className="px-6 py-3 font-medium">Date</th>
                <th className="px-6 py-3 font-medium">Status</th>
                <th className="px-6 py-3 font-medium text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200 bg-white">
              {reviews.map((review) => (
                <tr key={review.id} className="hover:bg-gray-50 transition-colors">
                  <td className="px-6 py-4 whitespace-normal min-w-[200px]">
                    <div className="flex gap-1 mb-1">{renderStars(review.rating)}</div>
                    <p className="text-gray-900 font-medium line-clamp-2">{review.comment}</p>
                  </td>
                  <td className="px-6 py-4">
                    <div className="text-indigo-600 font-medium">{review.product}</div>
                    <div className="text-gray-500 text-xs mt-1">By: {review.user}</div>
                  </td>
                  <td className="px-6 py-4 text-gray-500">{review.date}</td>
                  <td className="px-6 py-4">
                    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium
                      ${review.status === 'Approved' ? 'bg-green-100 text-green-800' : 
                        review.status === 'Pending Review' ? 'bg-orange-100 text-orange-800' : 
                        'bg-red-100 text-red-800'}`}>
                      {review.status}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-right">
                    <div className="flex items-center justify-end gap-2">
                      {review.status === 'Pending Review' && (
                        <>
                          <button className="text-green-600 hover:text-green-700 font-medium text-xs px-2 py-1 border border-green-200 rounded bg-green-50 transition-colors">Approve</button>
                          <button className="text-red-600 hover:text-red-700 font-medium text-xs px-2 py-1 border border-red-200 rounded bg-red-50 transition-colors">Reject</button>
                        </>
                      )}
                      <button className="text-gray-400 hover:text-red-600 p-1 transition-colors" aria-label="Delete"><Trash2 className="w-4 h-4" /></button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
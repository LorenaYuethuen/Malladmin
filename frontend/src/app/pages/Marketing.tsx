import { Plus, Tag, Gift, TrendingUp, Calendar, Clock } from 'lucide-react';

export function Marketing() {
  const campaigns = [
    { id: 1, name: "Summer Mega Sale", type: "Flash Sale", discount: "Up to 50%", status: "Active", ends: "2 days" },
    { id: 2, name: "New User Welcome", type: "Coupon", discount: "$10 Off", status: "Active", ends: "No expiry" },
    { id: 3, name: "Electronics Week", type: "Category Promo", discount: "20% Off", status: "Scheduled", ends: "Starts in 5 days" },
    { id: 4, name: "Spring Clearance", type: "Flash Sale", discount: "Buy 1 Get 1", status: "Ended", ends: "Ended 2 weeks ago" },
  ];

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-gray-900">Marketing (SMS)</h1>
          <p className="text-sm text-gray-500 mt-1">Manage campaigns, coupons, and product recommendations.</p>
        </div>
        <button className="flex items-center gap-2 bg-indigo-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-indigo-700 transition-colors shadow-sm">
          <Plus className="w-4 h-4" />
          Create Campaign
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-white p-6 rounded-xl border border-gray-200 shadow-sm flex items-start gap-4 hover:border-indigo-200 transition-colors cursor-pointer">
          <div className="w-12 h-12 rounded-lg bg-pink-50 flex items-center justify-center text-pink-600 shrink-0">
            <Gift className="w-6 h-6" />
          </div>
          <div>
            <h3 className="text-lg font-semibold text-gray-900">Coupons</h3>
            <p className="text-sm text-gray-500 mt-1 mb-3">Manage discount codes and vouchers for customers.</p>
            <button className="text-sm font-medium text-indigo-600 hover:text-indigo-700">Manage Coupons &rarr;</button>
          </div>
        </div>

        <div className="bg-white p-6 rounded-xl border border-gray-200 shadow-sm flex items-start gap-4 hover:border-indigo-200 transition-colors cursor-pointer">
          <div className="w-12 h-12 rounded-lg bg-orange-50 flex items-center justify-center text-orange-600 shrink-0">
            <Clock className="w-6 h-6" />
          </div>
          <div>
            <h3 className="text-lg font-semibold text-gray-900">Flash Sales</h3>
            <p className="text-sm text-gray-500 mt-1 mb-3">Configure time-limited promotions and countdowns.</p>
            <button className="text-sm font-medium text-indigo-600 hover:text-indigo-700">Manage Flash Sales &rarr;</button>
          </div>
        </div>

        <div className="bg-white p-6 rounded-xl border border-gray-200 shadow-sm flex items-start gap-4 hover:border-indigo-200 transition-colors cursor-pointer">
          <div className="w-12 h-12 rounded-lg bg-blue-50 flex items-center justify-center text-blue-600 shrink-0">
            <TrendingUp className="w-6 h-6" />
          </div>
          <div>
            <h3 className="text-lg font-semibold text-gray-900">Recommendations</h3>
            <p className="text-sm text-gray-500 mt-1 mb-3">Curate "New", "Hot", and "Brand" homepage sections.</p>
            <button className="text-sm font-medium text-indigo-600 hover:text-indigo-700">Manage Algorithms &rarr;</button>
          </div>
        </div>
      </div>

      <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden mt-6">
        <div className="px-6 py-5 border-b border-gray-200 bg-white">
          <h3 className="text-lg font-semibold text-gray-900">Active & Recent Campaigns</h3>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm whitespace-nowrap">
            <thead className="bg-gray-50 text-gray-500 border-b border-gray-200">
              <tr>
                <th className="px-6 py-3 font-medium">Campaign Name</th>
                <th className="px-6 py-3 font-medium">Type</th>
                <th className="px-6 py-3 font-medium">Discount Offer</th>
                <th className="px-6 py-3 font-medium">Status</th>
                <th className="px-6 py-3 font-medium">Duration/Ends</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200 bg-white">
              {campaigns.map((camp) => (
                <tr key={camp.id} className="hover:bg-gray-50 transition-colors">
                  <td className="px-6 py-4 font-medium text-gray-900">{camp.name}</td>
                  <td className="px-6 py-4 text-gray-500">
                    <span className="flex items-center gap-1.5">
                      <Tag className="w-3.5 h-3.5" /> {camp.type}
                    </span>
                  </td>
                  <td className="px-6 py-4 font-medium text-indigo-600">{camp.discount}</td>
                  <td className="px-6 py-4">
                    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium
                      ${camp.status === 'Active' ? 'bg-green-100 text-green-800' : 
                        camp.status === 'Scheduled' ? 'bg-blue-100 text-blue-800' : 
                        'bg-gray-100 text-gray-800'}`}>
                      {camp.status}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-gray-500 flex items-center gap-1.5">
                    <Calendar className="w-3.5 h-3.5" /> {camp.ends}
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
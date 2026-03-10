// pure frontend mockup
import { useState } from 'react';
import { Plus, Filter, Search, MoreHorizontal, Edit, Trash2, Image as ImageIcon, Layers, Tag, ListTree } from 'lucide-react';

export function Products() {
  const [activeTab, setActiveTab] = useState('products');

  const tabs = [
    { id: 'products', name: '商品列表', icon: ImageIcon },
    { id: 'categories', name: '分类', icon: ListTree },
    { id: 'brands', name: '品牌', icon: Tag },
    { id: 'attributes', name: '属性', icon: Layers },
  ];

  const products = [
    { id: 'PROD-001', name: '无线头戴式耳机', category: '电子产品', brand: 'Sony', price: '$299.99', stock: 45, status: '上架' },
    { id: 'PROD-002', name: '人体工学办公椅', category: '家具', brand: 'Herman Miller', price: '$199.50', stock: 12, status: '上架' },
    { id: 'PROD-003', name: '智能手表 Series 8', category: '电子产品', brand: 'Apple', price: '$399.00', stock: 0, status: '缺货' },
    { id: 'PROD-004', name: '有机棉T恤', category: '服装', brand: 'Nike', price: '$24.99', stock: 150, status: '上架' },
    { id: 'PROD-005', name: '不锈钢保温杯', category: '配件', brand: 'Yeti', price: '$35.00', stock: 85, status: '草稿' },
  ];

  const categories = [
    { id: 1, name: '电子产品', count: 124, status: '启用' },
    { id: 2, name: '家具', count: 45, status: '启用' },
    { id: 3, name: '服装', count: 350, status: '启用' },
    { id: 4, name: '配件', count: 89, status: '启用' },
  ];

  const brands = [
    { id: 1, name: 'Sony', initial: 'S', products: 45, status: '启用' },
    { id: 2, name: 'Apple', initial: 'A', products: 120, status: '启用' },
    { id: 3, name: 'Nike', initial: 'N', products: 85, status: '启用' },
    { id: 4, name: 'Samsung', initial: 'S', products: 64, status: '启用' },
  ];

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-gray-900">商品 (PMS)</h1>
          <p className="text-sm text-gray-500 mt-1">管理您的商品目录、分类、品牌和属性。</p>
        </div>
        <button className="flex items-center gap-2 bg-indigo-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-indigo-700 transition-colors shadow-sm">
          <Plus className="w-4 h-4" />
          {activeTab === 'products' ? '添加商品' : 
           activeTab === 'categories' ? '添加分类' : 
           activeTab === 'brands' ? '添加品牌' : '添加属性'}
        </button>
      </div>

      {/* Tabs */}
      <div className="flex space-x-1 bg-gray-200/50 p-1 rounded-lg w-max">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`flex items-center gap-2 px-4 py-2 rounded-md text-sm font-medium transition-all ${
              activeTab === tab.id 
                ? 'bg-white text-gray-900 shadow-sm' 
                : 'text-gray-500 hover:text-gray-700 hover:bg-gray-200/50'
            }`}
          >
            <tab.icon className="w-4 h-4" />
            {tab.name}
          </button>
        ))}
      </div>

      {/* Content Area */}
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden flex flex-col">
        {/* Toolbar */}
        <div className="p-4 border-b border-gray-200 flex flex-wrap gap-4 justify-between items-center bg-gray-50/50">
          <div className="relative w-full sm:w-80">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <input 
              type="text" 
              placeholder={`搜索 ${tabs.find(t => t.id === activeTab)?.name}...`} 
              className="w-full pl-9 pr-4 py-2 bg-white border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
          </div>
          <button className="flex items-center gap-2 px-4 py-2 border border-gray-300 bg-white rounded-lg text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors shadow-sm">
            <Filter className="w-4 h-4" />
            筛选
          </button>
        </div>

        {/* Dynamic Table based on Active Tab */}
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm whitespace-nowrap">
            
            {/* PRODUCT TAB */}
            {activeTab === 'products' && (
              <>
                <thead className="bg-gray-50 text-gray-500 border-b border-gray-200">
                  <tr>
                    <th className="px-6 py-3 font-medium">商品信息</th>
                    <th className="px-6 py-3 font-medium">分类/品牌</th>
                    <th className="px-6 py-3 font-medium">价格</th>
                    <th className="px-6 py-3 font-medium">库存</th>
                    <th className="px-6 py-3 font-medium">状态</th>
                    <th className="px-6 py-3 font-medium text-right">操作</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200 bg-white">
                  {products.map((product) => (
                    <tr key={product.id} className="hover:bg-gray-50 transition-colors">
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 rounded-lg bg-gray-100 flex items-center justify-center text-gray-400 shrink-0">
                            <ImageIcon className="w-5 h-5" />
                          </div>
                          <div>
                            <div className="font-medium text-gray-900">{product.name}</div>
                            <div className="text-xs text-gray-500">ID: {product.id}</div>
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <div className="text-gray-900">{product.category}</div>
                        <div className="text-xs text-gray-500">{product.brand}</div>
                      </td>
                      <td className="px-6 py-4 font-medium text-gray-900">{product.price}</td>
                      <td className="px-6 py-4">
                        <span className={`${product.stock === 0 ? 'text-red-600 font-medium' : 'text-gray-600'}`}>
                          {product.stock} 件
                        </span>
                      </td>
                      <td className="px-6 py-4">
                        <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium
                          ${product.status === '上架' ? 'bg-green-100 text-green-800' : 
                            product.status === '缺货' ? 'bg-red-100 text-red-800' : 
                            'bg-gray-100 text-gray-800'}`}>
                          {product.status}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-right">
                        <div className="flex items-center justify-end gap-2 text-gray-400">
                          <button className="hover:text-indigo-600 transition-colors p-1" aria-label="Edit"><Edit className="w-4 h-4" /></button>
                          <button className="hover:text-red-600 transition-colors p-1" aria-label="Delete"><Trash2 className="w-4 h-4" /></button>
                          <button className="hover:text-gray-600 transition-colors p-1" aria-label="More"><MoreHorizontal className="w-4 h-4" /></button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </>
            )}

            {/* CATEGORIES TAB */}
            {activeTab === 'categories' && (
              <>
                <thead className="bg-gray-50 text-gray-500 border-b border-gray-200">
                  <tr>
                    <th className="px-6 py-3 font-medium">分类名称</th>
                    <th className="px-6 py-3 font-medium">商品数量</th>
                    <th className="px-6 py-3 font-medium">状态</th>
                    <th className="px-6 py-3 font-medium text-right">操作</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200 bg-white">
                  {categories.map((cat) => (
                    <tr key={cat.id} className="hover:bg-gray-50 transition-colors">
                      <td className="px-6 py-4 font-medium text-gray-900">{cat.name}</td>
                      <td className="px-6 py-4 text-gray-600">{cat.count} 件商品</td>
                      <td className="px-6 py-4">
                        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
                          {cat.status}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-right">
                        <div className="flex items-center justify-end gap-2 text-gray-400">
                          <button className="hover:text-indigo-600 transition-colors p-1"><Edit className="w-4 h-4" /></button>
                          <button className="hover:text-red-600 transition-colors p-1"><Trash2 className="w-4 h-4" /></button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </>
            )}

            {/* BRANDS TAB */}
            {activeTab === 'brands' && (
              <>
                <thead className="bg-gray-50 text-gray-500 border-b border-gray-200">
                  <tr>
                    <th className="px-6 py-3 font-medium">品牌</th>
                    <th className="px-6 py-3 font-medium">商品数量</th>
                    <th className="px-6 py-3 font-medium">状态</th>
                    <th className="px-6 py-3 font-medium text-right">操作</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200 bg-white">
                  {brands.map((brand) => (
                    <tr key={brand.id} className="hover:bg-gray-50 transition-colors">
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 rounded bg-gray-100 flex items-center justify-center font-bold text-gray-500">
                            {brand.initial}
                          </div>
                          <span className="font-medium text-gray-900">{brand.name}</span>
                        </div>
                      </td>
                      <td className="px-6 py-4 text-gray-600">{brand.products} 件商品</td>
                      <td className="px-6 py-4">
                        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
                          {brand.status}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-right">
                        <div className="flex items-center justify-end gap-2 text-gray-400">
                          <button className="hover:text-indigo-600 transition-colors p-1"><Edit className="w-4 h-4" /></button>
                          <button className="hover:text-red-600 transition-colors p-1"><Trash2 className="w-4 h-4" /></button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </>
            )}

            {/* ATTRIBUTES TAB */}
            {activeTab === 'attributes' && (
              <>
                <thead className="bg-gray-50 text-gray-500 border-b border-gray-200">
                  <tr>
                    <th className="px-6 py-3 font-medium">属性名称</th>
                    <th className="px-6 py-3 font-medium">属性值</th>
                    <th className="px-6 py-3 font-medium text-right">操作</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200 bg-white">
                  <tr className="hover:bg-gray-50 transition-colors">
                    <td className="px-6 py-4 font-medium text-gray-900">颜色</td>
                    <td className="px-6 py-4 text-gray-500">红色, 蓝色, 绿色, 黑色, 白色</td>
                    <td className="px-6 py-4 text-right text-gray-400">
                      <button className="hover:text-indigo-600 transition-colors p-1"><Edit className="w-4 h-4" /></button>
                    </td>
                  </tr>
                  <tr className="hover:bg-gray-50 transition-colors">
                    <td className="px-6 py-4 font-medium text-gray-900">尺寸</td>
                    <td className="px-6 py-4 text-gray-500">XS, S, M, L, XL, XXL</td>
                    <td className="px-6 py-4 text-right text-gray-400">
                      <button className="hover:text-indigo-600 transition-colors p-1"><Edit className="w-4 h-4" /></button>
                    </td>
                  </tr>
                </tbody>
              </>
            )}
          </table>
        </div>
        
        {/* Pagination */}
        <div className="p-4 border-t border-gray-200 flex flex-col sm:flex-row items-center justify-between text-sm text-gray-500 gap-4 bg-white">
          <div>显示 1 到 5 条，共 24 条结果</div>
          <div className="flex items-center gap-1">
            <button className="px-3 py-1 border border-gray-300 rounded-md hover:bg-gray-50 disabled:opacity-50">上一页</button>
            <button className="px-3 py-1 bg-indigo-50 text-indigo-600 font-medium rounded-md">1</button>
            <button className="px-3 py-1 hover:bg-gray-50 rounded-md text-gray-700">2</button>
            <button className="px-3 py-1 border border-gray-300 rounded-md hover:bg-gray-50">下一页</button>
          </div>
        </div>
      </div>
    </div>
  );
}
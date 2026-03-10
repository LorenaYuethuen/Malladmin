import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router';
import {
  ArrowLeft,
  Package,
  Edit,
  Trash2,
  Image as ImageIcon,
  Tag,
  DollarSign,
  Box,
  RefreshCw,
  CheckCircle,
  XCircle,
  AlertCircle,
} from 'lucide-react';
import { productService } from '../services/productService';
import { ProductStatus, type Product } from '../types/product';

export function ProductDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [product, setProduct] = useState<Product | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    if (id) {
      fetchProduct();
    }
  }, [id]);

  const fetchProduct = async () => {
    if (!id) return;
    
    setLoading(true);
    setError(null);
    try {
      const data = await productService.getProductById(id);
      setProduct(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch product');
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async () => {
    if (!id || !confirm('Are you sure you want to delete this product?')) return;
    
    setDeleting(true);
    try {
      await productService.deleteProduct(id);
      navigate('/products');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete product');
    } finally {
      setDeleting(false);
    }
  };

  const handleEdit = () => {
    navigate(`/products/${id}/edit`);
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
    }).format(amount);
  };

  const getStatusIcon = (status: ProductStatus) => {
    switch(status) {
      case ProductStatus.ACTIVE: return <CheckCircle className="w-5 h-5 text-green-500" />;
      case ProductStatus.INACTIVE: return <XCircle className="w-5 h-5 text-gray-500" />;
      case ProductStatus.OUT_OF_STOCK: return <AlertCircle className="w-5 h-5 text-orange-500" />;
      case ProductStatus.DRAFT: return <AlertCircle className="w-5 h-5 text-blue-500" />;
      case ProductStatus.DISCONTINUED: return <XCircle className="w-5 h-5 text-red-500" />;
      default: return null;
    }
  };

  const getStatusStyle = (status: ProductStatus) => {
    switch(status) {
      case ProductStatus.ACTIVE: return 'bg-green-50 text-green-700 ring-green-600/20';
      case ProductStatus.INACTIVE: return 'bg-gray-50 text-gray-600 ring-gray-500/10';
      case ProductStatus.OUT_OF_STOCK: return 'bg-orange-50 text-orange-700 ring-orange-600/20';
      case ProductStatus.DRAFT: return 'bg-blue-50 text-blue-700 ring-blue-600/20';
      case ProductStatus.DISCONTINUED: return 'bg-red-50 text-red-700 ring-red-600/10';
      default: return 'bg-gray-50 text-gray-600 ring-gray-500/10';
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <RefreshCw className="w-8 h-8 animate-spin text-indigo-600" />
      </div>
    );
  }

  if (error || !product) {
    return (
      <div className="max-w-7xl mx-auto p-6">
        <div className="bg-red-50 border border-red-200 rounded-lg p-4">
          <p className="text-sm text-red-800">{error || 'Product not found'}</p>
        </div>
        <button
          onClick={() => navigate('/products')}
          className="mt-4 flex items-center gap-2 text-sm text-indigo-600 hover:text-indigo-700"
        >
          <ArrowLeft className="w-4 h-4" />
          Back to Products
        </button>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <button
            onClick={() => navigate('/products')}
            className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div>
            <h1 className="text-2xl font-bold text-gray-900">{product.name}</h1>
            <p className="text-sm text-gray-500 mt-1">SKU: {product.sku}</p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <span className={`inline-flex items-center gap-2 px-4 py-2 rounded-full text-sm font-medium ring-1 ring-inset ${getStatusStyle(product.status)}`}>
            {getStatusIcon(product.status)}
            {product.status}
          </span>
          <button
            onClick={handleEdit}
            className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-lg text-sm font-medium hover:bg-indigo-700 transition-colors"
          >
            <Edit className="w-4 h-4" />
            Edit
          </button>
          <button
            onClick={handleDelete}
            disabled={deleting}
            className="flex items-center gap-2 px-4 py-2 bg-red-600 text-white rounded-lg text-sm font-medium hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            <Trash2 className="w-4 h-4" />
            {deleting ? 'Deleting...' : 'Delete'}
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Main content */}
        <div className="lg:col-span-2 space-y-6">
          {/* Product images */}
          <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
            <div className="px-6 py-4 border-b border-gray-200 bg-gray-50">
              <h2 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
                <ImageIcon className="w-5 h-5" />
                Product Images
              </h2>
            </div>
            <div className="p-6">
              {product.images && product.images.length > 0 ? (
                <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                  {product.images.map((image) => (
                    <div key={image.id} className="relative aspect-square rounded-lg overflow-hidden border border-gray-200">
                      <img
                        src={image.url}
                        alt={image.altText || product.name}
                        className="w-full h-full object-cover"
                      />
                      {image.isPrimary && (
                        <div className="absolute top-2 right-2 bg-indigo-600 text-white text-xs px-2 py-1 rounded">
                          Primary
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              ) : (
                <div className="flex flex-col items-center justify-center py-12 text-gray-500">
                  <ImageIcon className="w-12 h-12 mb-2" />
                  <p>No images uploaded</p>
                </div>
              )}
            </div>
          </div>

          {/* Product description */}
          <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
            <div className="px-6 py-4 border-b border-gray-200 bg-gray-50">
              <h2 className="text-lg font-semibold text-gray-900">Description</h2>
            </div>
            <div className="p-6">
              {product.description ? (
                <p className="text-gray-700 whitespace-pre-wrap">{product.description}</p>
              ) : (
                <p className="text-gray-500 italic">No description provided</p>
              )}
            </div>
          </div>
        </div>

        {/* Sidebar */}
        <div className="space-y-6">
          {/* Pricing */}
          <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
            <div className="px-6 py-4 border-b border-gray-200 bg-gray-50">
              <h2 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
                <DollarSign className="w-5 h-5" />
                Pricing
              </h2>
            </div>
            <div className="p-6 space-y-3">
              <div>
                <p className="text-sm text-gray-500">Price</p>
                <p className="text-2xl font-bold text-gray-900">{formatCurrency(product.price)}</p>
              </div>
              {product.compareAtPrice && (
                <div>
                  <p className="text-sm text-gray-500">Compare at Price</p>
                  <p className="text-lg font-medium text-gray-600 line-through">
                    {formatCurrency(product.compareAtPrice)}
                  </p>
                </div>
              )}
              {product.costPrice && (
                <div>
                  <p className="text-sm text-gray-500">Cost Price</p>
                  <p className="text-lg font-medium text-gray-900">{formatCurrency(product.costPrice)}</p>
                </div>
              )}
            </div>
          </div>

          {/* Inventory */}
          {product.inventory && (
            <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
              <div className="px-6 py-4 border-b border-gray-200 bg-gray-50">
                <h2 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
                  <Box className="w-5 h-5" />
                  Inventory
                </h2>
              </div>
              <div className="p-6 space-y-3">
                <div className="flex justify-between">
                  <span className="text-gray-600">Total Quantity</span>
                  <span className="font-medium text-gray-900">{product.inventory.quantity}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600">Available</span>
                  <span className="font-medium text-green-600">{product.inventory.available}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600">Reserved</span>
                  <span className="font-medium text-orange-600">{product.inventory.reserved}</span>
                </div>
                {product.inventory.lowStockThreshold && (
                  <div className="flex justify-between pt-3 border-t border-gray-200">
                    <span className="text-gray-600">Low Stock Alert</span>
                    <span className="font-medium text-gray-900">{product.inventory.lowStockThreshold}</span>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Organization */}
          <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
            <div className="px-6 py-4 border-b border-gray-200 bg-gray-50">
              <h2 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
                <Tag className="w-5 h-5" />
                Organization
              </h2>
            </div>
            <div className="p-6 space-y-3">
              {product.category && (
                <div>
                  <p className="text-sm text-gray-500">Category</p>
                  <p className="font-medium text-gray-900">{product.category.name}</p>
                </div>
              )}
              {product.brand && (
                <div>
                  <p className="text-sm text-gray-500">Brand</p>
                  <p className="font-medium text-gray-900">{product.brand.name}</p>
                </div>
              )}
              {product.tags && product.tags.length > 0 && (
                <div>
                  <p className="text-sm text-gray-500 mb-2">Tags</p>
                  <div className="flex flex-wrap gap-2">
                    {product.tags.map((tag, index) => (
                      <span
                        key={index}
                        className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-800"
                      >
                        {tag}
                      </span>
                    ))}
                  </div>
                </div>
              )}
              {product.featured && (
                <div className="pt-3 border-t border-gray-200">
                  <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-yellow-100 text-yellow-800">
                    ⭐ Featured Product
                  </span>
                </div>
              )}
            </div>
          </div>

          {/* Product details */}
          <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
            <div className="px-6 py-4 border-b border-gray-200 bg-gray-50">
              <h2 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
                <Package className="w-5 h-5" />
                Product Details
              </h2>
            </div>
            <div className="p-6 space-y-3">
              <div>
                <p className="text-sm text-gray-500">SKU</p>
                <p className="font-medium text-gray-900">{product.sku}</p>
              </div>
              {product.barcode && (
                <div>
                  <p className="text-sm text-gray-500">Barcode</p>
                  <p className="font-medium text-gray-900">{product.barcode}</p>
                </div>
              )}
              {product.weight && (
                <div>
                  <p className="text-sm text-gray-500">Weight</p>
                  <p className="font-medium text-gray-900">
                    {product.weight} {product.weightUnit || 'kg'}
                  </p>
                </div>
              )}
              {product.dimensions && (
                <div>
                  <p className="text-sm text-gray-500">Dimensions</p>
                  <p className="font-medium text-gray-900">
                    {product.dimensions.length} × {product.dimensions.width} × {product.dimensions.height}{' '}
                    {product.dimensions.unit || 'cm'}
                  </p>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

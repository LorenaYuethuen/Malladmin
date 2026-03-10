import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router';
import {
  ArrowLeft,
  Package,
  User,
  MapPin,
  CreditCard,
  Truck,
  CheckCircle,
  Clock,
  XCircle,
  RefreshCw,
} from 'lucide-react';
import { orderService } from '../services/orderService';
import { OrderStatus, type Order } from '../types/order';

export function OrderDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [order, setOrder] = useState<Order | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [updating, setUpdating] = useState(false);

  // Fetch order details
  useEffect(() => {
    if (id) {
      fetchOrder();
    }
  }, [id]);

  const fetchOrder = async () => {
    if (!id) return;
    
    setLoading(true);
    setError(null);
    try {
      const data = await orderService.getOrderById(id);
      setOrder(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch order');
    } finally {
      setLoading(false);
    }
  };

  // Update order status
  const handleUpdateStatus = async (newStatus: OrderStatus) => {
    if (!id) return;
    
    setUpdating(true);
    try {
      await orderService.updateOrderStatus(id, { status: newStatus });
      await fetchOrder(); // Refresh order data
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update order');
    } finally {
      setUpdating(false);
    }
  };

  // Format date
  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  // Format currency
  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
    }).format(amount);
  };

  // Get status icon
  const getStatusIcon = (status: OrderStatus) => {
    switch(status) {
      case OrderStatus.DELIVERED: return <CheckCircle className="w-5 h-5 text-green-500" />;
      case OrderStatus.SHIPPED: return <Truck className="w-5 h-5 text-blue-500" />;
      case OrderStatus.PROCESSING: return <Clock className="w-5 h-5 text-orange-500" />;
      case OrderStatus.PENDING: return <Clock className="w-5 h-5 text-gray-500" />;
      case OrderStatus.CANCELLED: return <XCircle className="w-5 h-5 text-red-500" />;
      default: return null;
    }
  };

  // Get status style
  const getStatusStyle = (status: OrderStatus) => {
    switch(status) {
      case OrderStatus.DELIVERED: return 'bg-green-50 text-green-700 ring-green-600/20';
      case OrderStatus.SHIPPED: return 'bg-blue-50 text-blue-700 ring-blue-600/20';
      case OrderStatus.PROCESSING: return 'bg-orange-50 text-orange-700 ring-orange-600/20';
      case OrderStatus.PENDING: return 'bg-gray-50 text-gray-600 ring-gray-500/10';
      case OrderStatus.CANCELLED: return 'bg-red-50 text-red-700 ring-red-600/10';
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

  if (error || !order) {
    return (
      <div className="max-w-7xl mx-auto p-6">
        <div className="bg-red-50 border border-red-200 rounded-lg p-4">
          <p className="text-sm text-red-800">{error || 'Order not found'}</p>
        </div>
        <button
          onClick={() => navigate('/orders')}
          className="mt-4 flex items-center gap-2 text-sm text-indigo-600 hover:text-indigo-700"
        >
          <ArrowLeft className="w-4 h-4" />
          Back to Orders
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
            onClick={() => navigate('/orders')}
            className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div>
            <h1 className="text-2xl font-bold text-gray-900">
              Order {order.orderNumber}
            </h1>
            <p className="text-sm text-gray-500 mt-1">
              Placed on {formatDate(order.createdAt)}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <span className={`inline-flex items-center gap-2 px-4 py-2 rounded-full text-sm font-medium ring-1 ring-inset ${getStatusStyle(order.status)}`}>
            {getStatusIcon(order.status)}
            {order.status}
          </span>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Main content */}
        <div className="lg:col-span-2 space-y-6">
          {/* Order items */}
          <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
            <div className="px-6 py-4 border-b border-gray-200 bg-gray-50">
              <h2 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
                <Package className="w-5 h-5" />
                Order Items
              </h2>
            </div>
            <div className="p-6">
              <div className="space-y-4">
                {order.items && order.items.map((item, index) => (
                  <div key={index} className="flex items-center gap-4 pb-4 border-b border-gray-100 last:border-0">
                    <div className="w-16 h-16 bg-gray-100 rounded-lg flex items-center justify-center">
                      <Package className="w-8 h-8 text-gray-400" />
                    </div>
                    <div className="flex-1">
                      <h3 className="font-medium text-gray-900">{item.productName}</h3>
                      <p className="text-sm text-gray-500">SKU: {item.productSku}</p>
                      <p className="text-sm text-gray-500">Quantity: {item.quantity}</p>
                    </div>
                    <div className="text-right">
                      <p className="font-medium text-gray-900">{formatCurrency(item.price)}</p>
                      <p className="text-sm text-gray-500">each</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Shipping information */}
          {order.shippingAddress && (
            <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
              <div className="px-6 py-4 border-b border-gray-200 bg-gray-50">
                <h2 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
                  <Truck className="w-5 h-5" />
                  Shipping Information
                </h2>
              </div>
              <div className="p-6 space-y-4">
                <div>
                  <h3 className="text-sm font-medium text-gray-500 mb-1">Shipping Address</h3>
                  <p className="text-gray-900">{order.shippingAddress.fullName}</p>
                  <p className="text-gray-600">{order.shippingAddress.addressLine1}</p>
                  {order.shippingAddress.addressLine2 && (
                    <p className="text-gray-600">{order.shippingAddress.addressLine2}</p>
                  )}
                  <p className="text-gray-600">
                    {order.shippingAddress.city}, {order.shippingAddress.state} {order.shippingAddress.postalCode}
                  </p>
                  <p className="text-gray-600">{order.shippingAddress.country}</p>
                  <p className="text-gray-600 mt-2">Phone: {order.shippingAddress.phone}</p>
                </div>
                {order.trackingNumber && (
                  <div>
                    <h3 className="text-sm font-medium text-gray-500 mb-1">Tracking Number</h3>
                    <p className="text-gray-900 font-mono">{order.trackingNumber}</p>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Sidebar */}
        <div className="space-y-6">
          {/* Customer information */}
          <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
            <div className="px-6 py-4 border-b border-gray-200 bg-gray-50">
              <h2 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
                <User className="w-5 h-5" />
                Customer
              </h2>
            </div>
            <div className="p-6 space-y-3">
              <div>
                <p className="text-sm text-gray-500">Name</p>
                <p className="font-medium text-gray-900">{order.customerName || 'N/A'}</p>
              </div>
              <div>
                <p className="text-sm text-gray-500">Email</p>
                <p className="font-medium text-gray-900">{order.customerEmail || 'N/A'}</p>
              </div>
              <div>
                <p className="text-sm text-gray-500">Phone</p>
                <p className="font-medium text-gray-900">{order.customerPhone || 'N/A'}</p>
              </div>
            </div>
          </div>

          {/* Payment information */}
          <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
            <div className="px-6 py-4 border-b border-gray-200 bg-gray-50">
              <h2 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
                <CreditCard className="w-5 h-5" />
                Payment
              </h2>
            </div>
            <div className="p-6 space-y-3">
              <div className="flex justify-between">
                <span className="text-gray-600">Subtotal</span>
                <span className="font-medium text-gray-900">{formatCurrency(order.subtotal)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600">Shipping</span>
                <span className="font-medium text-gray-900">{formatCurrency(order.shippingCost)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600">Tax</span>
                <span className="font-medium text-gray-900">{formatCurrency(order.tax)}</span>
              </div>
              {order.discount > 0 && (
                <div className="flex justify-between text-green-600">
                  <span>Discount</span>
                  <span className="font-medium">-{formatCurrency(order.discount)}</span>
                </div>
              )}
              <div className="pt-3 border-t border-gray-200 flex justify-between">
                <span className="font-semibold text-gray-900">Total</span>
                <span className="font-semibold text-gray-900">{formatCurrency(order.totalAmount || order.total)}</span>
              </div>
              <div className="pt-3 border-t border-gray-200">
                <div className="flex justify-between items-center">
                  <span className="text-gray-600">Payment Status</span>
                  <span className={`inline-flex items-center px-2 py-1 rounded-md text-xs font-medium ${
                    order.paymentStatus === 'completed' ? 'text-green-700 bg-green-50' :
                    order.paymentStatus === 'refunded' ? 'text-gray-700 bg-gray-100' :
                    'text-orange-700 bg-orange-50'
                  }`}>
                    {order.paymentStatus}
                  </span>
                </div>
                <p className="text-sm text-gray-500 mt-1">Method: {order.paymentMethod}</p>
              </div>
            </div>
          </div>

          {/* Actions */}
          <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
            <div className="px-6 py-4 border-b border-gray-200 bg-gray-50">
              <h2 className="text-lg font-semibold text-gray-900">Actions</h2>
            </div>
            <div className="p-6 space-y-2">
              {order.status === OrderStatus.PENDING && (
                <button
                  onClick={() => handleUpdateStatus(OrderStatus.PROCESSING)}
                  disabled={updating}
                  className="w-full px-4 py-2 bg-indigo-600 text-white rounded-lg text-sm font-medium hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                  {updating ? 'Updating...' : 'Start Processing'}
                </button>
              )}
              {order.status === OrderStatus.PROCESSING && (
                <button
                  onClick={() => handleUpdateStatus(OrderStatus.SHIPPED)}
                  disabled={updating}
                  className="w-full px-4 py-2 bg-indigo-600 text-white rounded-lg text-sm font-medium hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                  {updating ? 'Updating...' : 'Mark as Shipped'}
                </button>
              )}
              {order.status === OrderStatus.SHIPPED && (
                <button
                  onClick={() => handleUpdateStatus(OrderStatus.DELIVERED)}
                  disabled={updating}
                  className="w-full px-4 py-2 bg-green-600 text-white rounded-lg text-sm font-medium hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                  {updating ? 'Updating...' : 'Mark as Delivered'}
                </button>
              )}
              {(order.status === OrderStatus.PENDING || order.status === OrderStatus.PROCESSING) && (
                <button
                  onClick={() => handleUpdateStatus(OrderStatus.CANCELLED)}
                  disabled={updating}
                  className="w-full px-4 py-2 bg-red-600 text-white rounded-lg text-sm font-medium hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                  {updating ? 'Updating...' : 'Cancel Order'}
                </button>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

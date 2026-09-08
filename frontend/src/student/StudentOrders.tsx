import React, { useState, useEffect, useCallback } from 'react';
import { Order } from '../types';
import { fetchStudentOrders, cancelStudentOrder } from '../services/orderService';
import { useAuth } from '../auth/AuthContext';
import { useStudentOrdersRealtime } from '../hooks/useOrderRealtime';
import { Card } from '../shared/components/Card';
import { Button } from '../shared/components/Button';
import {
  ShoppingBag,
  Clock,
  ChevronRight,
  Loader2,
  RefreshCw,
  ArrowRight,
  XCircle,
  AlertTriangle,
  Timer,
} from 'lucide-react';

interface StudentOrdersProps {
  onSelectOrder?: (orderId: string) => void;
  onNavigateToMenu?: () => void;
}

export const StudentOrders: React.FC<StudentOrdersProps> = ({
  onSelectOrder,
  onNavigateToMenu,
}) => {
  const { user } = useAuth();
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [confirmCancelOrder, setConfirmCancelOrder] = useState<Order | null>(null);
  const [isCancelling, setIsCancelling] = useState<boolean>(false);
  const [cancelError, setCancelError] = useState<string | null>(null);

  const loadOrders = useCallback(async (showFullSpinner = true) => {
    if (showFullSpinner) setLoading(true);
    try {
      const data = await fetchStudentOrders();
      setOrders(data);
    } catch (err) {
      console.error('[StudentOrders] Error loading orders:', err);
    } finally {
      if (showFullSpinner) setLoading(false);
    }
  }, []);

  const handleRealtimeChange = useCallback(() => {
    loadOrders(false);
  }, [loadOrders]);

  useStudentOrdersRealtime(user?.id, handleRealtimeChange);

  useEffect(() => {
    loadOrders(true);

    // 25-second lightweight safety net fallback polling
    const interval = setInterval(() => {
      loadOrders(false);
    }, 25000);

    return () => clearInterval(interval);
  }, [loadOrders]);

  const handleCancelClick = (e: React.MouseEvent, order: Order) => {
    e.stopPropagation();
    setCancelError(null);
    setConfirmCancelOrder(order);
  };

  const handleConfirmCancel = async () => {
    if (!confirmCancelOrder || isCancelling) return;

    setIsCancelling(true);
    setCancelError(null);

    const result = await cancelStudentOrder(confirmCancelOrder.id);

    if (result.success) {
      setIsCancelling(false);
      setConfirmCancelOrder(null);
      await loadOrders();
    } else {
      setIsCancelling(false);
      setCancelError(result.error || 'Unable to cancel the order. Please try again.');
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status.toLowerCase()) {
      case 'placed':
        return (
          <span className="bg-amber-100 text-amber-900 border border-amber-300 font-extrabold px-2.5 py-0.5 rounded-md text-[10px] uppercase">
            Placed
          </span>
        );
      case 'ready':
        return (
          <span className="bg-blue-100 text-blue-800 border border-blue-200 font-extrabold px-2.5 py-0.5 rounded-md text-[10px] uppercase">
            Ready for Pickup
          </span>
        );
      case 'delivered':
        return (
          <span className="bg-emerald-100 text-emerald-800 border border-emerald-200 font-extrabold px-2.5 py-0.5 rounded-md text-[10px] uppercase">
            Delivered
          </span>
        );
      case 'cancelled':
        return (
          <span className="bg-rose-100 text-rose-800 border border-rose-200 font-extrabold px-2.5 py-0.5 rounded-md text-[10px] uppercase">
            Cancelled
          </span>
        );
      default:
        return (
          <span className="bg-slate-100 text-slate-700 border border-slate-200 font-extrabold px-2.5 py-0.5 rounded-md text-[10px] uppercase">
            {status}
          </span>
        );
    }
  };

  return (
    <div className="space-y-5 pb-24 sm:pb-8 max-w-2xl mx-auto relative">
      {/* Header & Refresh */}
      <div className="flex items-center justify-between pt-2">
        <div>
          <h1 className="text-xl font-extrabold text-slate-900 tracking-tight">My Orders</h1>
          <p className="text-xs text-slate-500 font-medium mt-0.5">
            Track active preparation & view order history
          </p>
        </div>

        <button
          onClick={() => loadOrders(true)}
          title="Refresh Orders"
          className="p-2.5 rounded-xl bg-white border border-slate-200 text-slate-500 hover:text-slate-900 transition-colors shrink-0 shadow-xs"
        >
          <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
        </button>
      </div>

      {/* Loading State */}
      {loading ? (
        <div className="bg-white border border-slate-200/90 rounded-2xl p-8 flex flex-col items-center justify-center space-y-2 shadow-xs">
          <Loader2 className="w-6 h-6 text-rose-600 animate-spin" />
          <p className="text-xs font-semibold text-slate-500">Fetching your canteen orders...</p>
        </div>
      ) : orders.length === 0 ? (
        /* Empty State */
        <div className="bg-white border border-slate-200 rounded-3xl p-8 text-center space-y-4 shadow-xs max-w-md mx-auto my-4">
          <div className="w-16 h-16 rounded-full bg-rose-50 text-rose-600 flex items-center justify-center mx-auto">
            <ShoppingBag className="w-8 h-8" />
          </div>
          <div className="space-y-1">
            <h2 className="text-lg font-bold text-slate-900">No orders placed yet</h2>
            <p className="text-xs text-slate-500 max-w-xs mx-auto leading-relaxed">
              When you order food from the campus canteen, your order details and pickup status will appear here.
            </p>
          </div>
          {onNavigateToMenu && (
            <Button
              size="sm"
              variant="primary"
              onClick={onNavigateToMenu}
              rightIcon={<ArrowRight className="w-4 h-4" />}
              className="mt-2"
            >
              Browse Food Menu
            </Button>
          )}
        </div>
      ) : (
        /* Orders List */
        <div className="space-y-3">
          {orders.map((order) => {
            const formattedDate = new Date(order.createdAt).toLocaleString('en-US', {
              month: 'short',
              day: 'numeric',
              hour: 'numeric',
              minute: '2-digit',
              hour12: true,
            });

            const formattedCancelledDate = order.cancelledAt
              ? new Date(order.cancelledAt).toLocaleString('en-US', {
                  month: 'short',
                  day: 'numeric',
                  hour: 'numeric',
                  minute: '2-digit',
                  hour12: true,
                })
              : null;

            const isPlaced = order.status.toLowerCase() === 'placed';

            return (
              <Card
                key={order.id}
                padding="md"
                className="bg-white border-slate-200 hover:border-slate-300 transition-all cursor-pointer shadow-xs"
                onClick={() => onSelectOrder && onSelectOrder(order.id)}
              >
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div className="space-y-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-sm font-extrabold text-slate-900">
                        Order #{order.orderNumber}
                      </span>
                      {getStatusBadge(order.status)}
                      {isPlaced && (
                        <span className="inline-flex items-center gap-1 bg-amber-50 text-amber-900 border border-amber-200 px-2 py-0.5 rounded-md text-[10px] font-bold">
                          <Timer className="w-3 h-3 text-amber-700" /> Active Queue • Click for Live ETA
                        </span>
                      )}
                    </div>

                    <div className="flex items-center gap-2 flex-wrap text-xs text-slate-500 font-medium">
                      <span className="flex items-center gap-1">
                        <Clock className="w-3.5 h-3.5 text-slate-400" /> {formattedDate}
                      </span>
                      <span>•</span>
                      <span>{order.pickupMethod}</span>
                    </div>

                    {formattedCancelledDate && (
                      <p className="text-[11px] font-semibold text-rose-600 pt-0.5">
                        Cancelled at: {formattedCancelledDate}
                      </p>
                    )}
                  </div>

                  <div className="flex items-center justify-between sm:justify-end gap-3 shrink-0 pt-2 sm:pt-0 border-t sm:border-t-0 border-slate-100">
                    {isPlaced && (
                      <button
                        onClick={(e) => handleCancelClick(e, order)}
                        className="px-3 py-1.5 rounded-xl text-xs font-bold text-rose-600 hover:text-white bg-rose-50 hover:bg-rose-600 border border-rose-200 transition-all shadow-2xs flex items-center gap-1 cursor-pointer"
                        title="Cancel this order"
                      >
                        <XCircle className="w-3.5 h-3.5" />
                        <span>Cancel Order</span>
                      </button>
                    )}

                    <div className="flex items-center gap-2 text-right">
                      <div>
                        <span className="text-sm font-black text-rose-600">
                          ₹{order.totalAmount}
                        </span>
                        <span className="text-[10px] text-slate-400 font-semibold block">Total</span>
                      </div>
                      <div className="w-8 h-8 rounded-xl bg-slate-100 text-slate-500 flex items-center justify-center">
                        <ChevronRight className="w-4 h-4" />
                      </div>
                    </div>
                  </div>
                </div>
              </Card>
            );
          })}
        </div>
      )}

      {/* Confirmation Modal Dialog for Order Cancellation */}
      {confirmCancelOrder && (
        <div className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center p-4 animate-fadeIn">
          <div className="bg-white border border-slate-200 rounded-3xl p-6 max-w-sm w-full space-y-4 shadow-xl">
            <div className="w-12 h-12 rounded-full bg-rose-100 text-rose-600 flex items-center justify-center mx-auto">
              <AlertTriangle className="w-6 h-6" />
            </div>

            <div className="text-center space-y-1">
              <h3 className="text-base font-bold text-slate-900">
                Cancel Order #{confirmCancelOrder.orderNumber}?
              </h3>
              <p className="text-xs text-slate-500 leading-relaxed">
                Are you sure you want to cancel this order? This action cannot be undone and will notify the canteen staff.
              </p>
            </div>

            {cancelError && (
              <div className="bg-rose-50 border border-rose-200 text-rose-800 text-xs font-semibold p-3 rounded-xl">
                {cancelError}
              </div>
            )}

            <div className="flex items-center gap-2 pt-1">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setConfirmCancelOrder(null)}
                disabled={isCancelling}
                className="flex-1"
              >
                Keep Order
              </Button>
              <Button
                variant="primary"
                size="sm"
                onClick={handleConfirmCancel}
                disabled={isCancelling}
                leftIcon={isCancelling ? <Loader2 className="w-4 h-4 animate-spin" /> : undefined}
                className="flex-1 bg-rose-600 hover:bg-rose-700 text-white border-none"
              >
                {isCancelling ? 'Cancelling...' : 'Yes, Cancel Order'}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};


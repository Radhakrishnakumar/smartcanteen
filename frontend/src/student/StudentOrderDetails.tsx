import React, { useState, useEffect, useCallback } from 'react';
import { Order, OrderItem, OrderEtaPrediction } from '../types';
import { fetchStudentOrderDetails, cancelStudentOrder, fetchOrderEta, getConfidenceBadgeStyle } from '../services/orderService';
import { useAuth } from '../auth/AuthContext';
import { useStudentOrdersRealtime } from '../hooks/useOrderRealtime';
import { Card } from '../shared/components/Card';
import { Button } from '../shared/components/Button';
import {
  ArrowLeft,
  Clock,
  Store,
  Loader2,
  AlertCircle,
  XCircle,
  AlertTriangle,
  KeyRound,
  Sparkles,
  Users,
  Timer,
  CheckCircle2,
  Radio,
} from 'lucide-react';
import { DEFAULT_FOOD_IMAGE } from '../services/menuService';

interface StudentOrderDetailsProps {
  orderId: string;
  onBack: () => void;
}

export const StudentOrderDetails: React.FC<StudentOrderDetailsProps> = ({
  orderId,
  onBack,
}) => {
  const { user } = useAuth();
  const [order, setOrder] = useState<Order | null>(null);
  const [items, setItems] = useState<OrderItem[]>([]);
  const [eta, setEta] = useState<OrderEtaPrediction | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [loadingEta, setLoadingEta] = useState<boolean>(false);
  const [showCancelModal, setShowCancelModal] = useState<boolean>(false);
  const [isCancelling, setIsCancelling] = useState<boolean>(false);
  const [cancelError, setCancelError] = useState<string | null>(null);

  const loadDetails = useCallback(async (showFullSpinner = true) => {
    if (showFullSpinner) setLoading(true);
    try {
      const res = await fetchStudentOrderDetails(orderId);
      if (res) {
        setOrder(res.order);
        setItems(res.items);

        // Fetch ETA if placed
        if (res.order.status.toLowerCase() === 'placed') {
          setLoadingEta(true);
          const etaRes = await fetchOrderEta(orderId);
          setEta(etaRes);
          setLoadingEta(false);
        } else {
          setEta(null);
        }
      }
    } catch (err) {
      console.error('[StudentOrderDetails] Failed to fetch details:', err);
    } finally {
      if (showFullSpinner) setLoading(false);
    }
  }, [orderId]);

  // Realtime subscription callback for instant status reconciliation
  const handleRealtimeOrderChange = useCallback((payload: { newRecord: any; oldRecord: any }) => {
    const affectedId = payload.newRecord?.id || payload.oldRecord?.id;
    if (affectedId === orderId) {
      loadDetails(false);
    }
  }, [orderId, loadDetails]);

  const { status: realtimeStatus } = useStudentOrdersRealtime(user?.id, handleRealtimeOrderChange);

  useEffect(() => {
    loadDetails(true);

    // Safety net: 25-second lightweight polling fallback
    const interval = setInterval(() => {
      loadDetails(false);
    }, 25000);

    // Refresh ETA when window regains focus
    const handleFocus = () => {
      loadDetails(false);
    };
    window.addEventListener('focus', handleFocus);

    return () => {
      clearInterval(interval);
      window.removeEventListener('focus', handleFocus);
    };
  }, [loadDetails]);

  const handleConfirmCancel = async () => {
    if (!order || isCancelling) return;

    setIsCancelling(true);
    setCancelError(null);

    const result = await cancelStudentOrder(order.id);

    if (result.success) {
      setIsCancelling(false);
      setShowCancelModal(false);
      await loadDetails(true);
    } else {
      setIsCancelling(false);
      setCancelError(result.error || 'Unable to cancel the order. Please try again.');
    }
  };

  if (loading) {
    return (
      <div className="bg-white border border-slate-200/90 rounded-2xl p-12 flex flex-col items-center justify-center space-y-2 shadow-xs max-w-xl mx-auto my-6">
        <Loader2 className="w-6 h-6 text-rose-600 animate-spin" />
        <p className="text-xs font-semibold text-slate-500">Loading order details & queue status...</p>
      </div>
    );
  }

  if (!order) {
    return (
      <div className="bg-white border border-slate-200 rounded-3xl p-8 text-center space-y-4 shadow-xs max-w-md mx-auto my-6">
        <AlertCircle className="w-10 h-10 text-amber-500 mx-auto" />
        <h2 className="text-lg font-bold text-slate-900">Order Not Found</h2>
        <p className="text-xs text-slate-500">
          The requested order could not be retrieved or you do not have permission to view it.
        </p>
        <Button variant="outline" size="sm" onClick={onBack}>
          Back to My Orders
        </Button>
      </div>
    );
  }

  const getStatusBadge = (status: string) => {
    switch (status.toLowerCase()) {
      case 'placed':
        return <span className="bg-amber-100 text-amber-900 border border-amber-300 font-extrabold px-2.5 py-0.5 rounded-md text-[11px] uppercase">Placed</span>;
      case 'ready':
        return <span className="bg-blue-100 text-blue-800 border border-blue-200 font-extrabold px-2.5 py-0.5 rounded-md text-[11px] uppercase">Ready for Pickup</span>;
      case 'delivered':
        return <span className="bg-emerald-100 text-emerald-800 border border-emerald-200 font-extrabold px-2.5 py-0.5 rounded-md text-[11px] uppercase">Delivered</span>;
      case 'cancelled':
        return <span className="bg-rose-100 text-rose-800 border border-rose-200 font-extrabold px-2.5 py-0.5 rounded-md text-[11px] uppercase">Cancelled</span>;
      default:
        return <span className="bg-slate-100 text-slate-700 border border-slate-200 font-extrabold px-2.5 py-0.5 rounded-md text-[11px] uppercase">{status}</span>;
    }
  };

  const formattedDate = new Date(order.createdAt).toLocaleString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  });

  const formattedCancelledDate = order.cancelledAt
    ? new Date(order.cancelledAt).toLocaleString('en-US', {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
        hour: 'numeric',
        minute: '2-digit',
        hour12: true,
      })
    : null;

  const isPlaced = order.status.toLowerCase() === 'placed';
  const isReady = order.status.toLowerCase() === 'ready';

  return (
    <div className="space-y-6 pb-24 sm:pb-12 max-w-xl mx-auto relative">
      {/* Back Button & Header */}
      <div className="flex items-center justify-between pt-2">
        <div className="flex items-center gap-3">
          <button
            onClick={onBack}
            className="p-2 rounded-xl bg-white border border-slate-200 text-slate-600 hover:text-slate-900 transition-colors shadow-xs"
            title="Back to Orders"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div>
            <h1 className="text-xl font-extrabold text-slate-900 tracking-tight">
              Order #{order.orderNumber}
            </h1>
            <div className="flex items-center gap-2 text-xs text-slate-500 font-medium mt-0.5">
              <span>{formattedDate}</span>
              <span>•</span>
              <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-slate-600">
                <Radio className={`w-3 h-3 ${realtimeStatus === 'connected' ? 'text-emerald-500 animate-pulse' : 'text-amber-500'}`} />
                {realtimeStatus === 'connected' ? 'Live connected' : 'Reconnecting...'}
              </span>
            </div>
          </div>
        </div>

        {isPlaced && (
          <button
            onClick={() => {
              setCancelError(null);
              setShowCancelModal(true);
            }}
            className="px-3.5 py-2 rounded-xl text-xs font-bold text-rose-600 hover:text-white bg-rose-50 hover:bg-rose-600 border border-rose-200 transition-all shadow-2xs flex items-center gap-1.5 cursor-pointer shrink-0"
          >
            <XCircle className="w-4 h-4" />
            <span>Cancel Order</span>
          </button>
        )}
      </div>

      {/* Prominent Ready Status Banner when Ready */}
      {isReady && (
        <Card padding="md" className="bg-blue-600 text-white border-none shadow-md text-center space-y-2 rounded-3xl animate-fadeIn">
          <div className="w-12 h-12 rounded-full bg-white/20 text-white flex items-center justify-center mx-auto">
            <CheckCircle2 className="w-7 h-7" />
          </div>
          <div className="space-y-0.5">
            <span className="text-[11px] font-bold uppercase tracking-widest text-blue-100 block">
              Kitchen Preparation Complete
            </span>
            <h2 className="text-2xl font-black tracking-tight">READY FOR PICKUP</h2>
          </div>
          <p className="text-xs text-blue-100 font-medium max-w-xs mx-auto">
            Please head to {order.pickupLocationName || order.pickupMethod} and show your 4-digit OTP code below.
          </p>
        </Card>
      )}

      {/* Dynamic AI-Assisted ETA Prediction Card when Placed */}
      {isPlaced && eta && (
        <Card padding="md" className="bg-white border-2 border-slate-900/90 shadow-md space-y-4 rounded-3xl">
          <div className="flex items-center justify-between border-b border-slate-100 pb-3">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-xl bg-slate-900 text-amber-400 flex items-center justify-center font-bold">
                <Timer className="w-4 h-4" />
              </div>
              <div>
                <h2 className="text-sm font-black text-slate-900">Live Kitchen Queue & ETA</h2>
                <p className="text-xs text-slate-500 font-medium">Estimated preparation completion time</p>
              </div>
            </div>

            {/* Confidence Badge */}
            {(() => {
              const style = getConfidenceBadgeStyle(eta.confidenceLevel);
              return (
                <span className={`text-[10px] font-extrabold px-2.5 py-1 rounded-full border ${style.bgClass} ${style.borderClass}`}>
                  {style.label}
                </span>
              );
            })()}
          </div>

          <div className="grid grid-cols-2 gap-3 text-center">
            {/* Queue Position Box */}
            <div className="bg-slate-50 border border-slate-200 p-3.5 rounded-2xl space-y-1">
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block flex items-center justify-center gap-1">
                <Users className="w-3.5 h-3.5 text-slate-500" /> Queue Position
              </span>
              <span className="text-xl font-black text-slate-900 block">
                {eta.ordersAhead === 0 ? 'Next in Queue' : `${eta.ordersAhead} ${eta.ordersAhead === 1 ? 'order' : 'orders'} ahead`}
              </span>
              <span className="text-[11px] text-slate-500 font-medium block">
                Position #{eta.queuePosition} in line
              </span>
            </div>

            {/* Estimated Time Box */}
            <div className="bg-slate-50 border border-slate-200 p-3.5 rounded-2xl space-y-1">
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block flex items-center justify-center gap-1">
                <Sparkles className="w-3.5 h-3.5 text-amber-600" /> Estimated Ready
              </span>
              <span className="text-xl font-black text-rose-600 block">
                {eta.formattedRange}
              </span>
              {eta.expectedAround && (
                <span className="text-[11px] text-slate-600 font-bold block">
                  Expected ~{eta.expectedAround}
                </span>
              )}
            </div>
          </div>

          <div className="flex items-center justify-between text-[11px] text-slate-500 pt-1">
            <span>Pickup: <strong className="text-slate-800 font-bold">{eta.pickupLocationName}</strong></span>
            {loadingEta ? (
              <span className="flex items-center gap-1 text-slate-400 font-medium">
                <Loader2 className="w-3 h-3 animate-spin text-rose-600" /> Updating ETA...
              </span>
            ) : (
              <span className="text-slate-400 font-medium">Auto-updates live</span>
            )}
          </div>
        </Card>
      )}

      {/* Pickup OTP Card */}
      {order.pickupOtp && (
        <Card padding="md" className="bg-gradient-to-br from-slate-900 to-slate-800 text-white border-2 border-amber-400/80 shadow-md text-center space-y-2 rounded-3xl">
          <div className="inline-flex items-center gap-1.5 bg-amber-400/20 text-amber-300 px-3 py-0.5 rounded-full text-[11px] font-bold uppercase tracking-wider">
            <KeyRound className="w-3.5 h-3.5" /> Pickup OTP
          </div>
          <div className="text-4xl sm:text-5xl font-black tracking-widest text-amber-400 font-mono py-1 select-all">
            {order.pickupOtp}
          </div>
          <p className="text-xs font-bold text-slate-200">
            Show this 4-digit code to the canteen worker when picking up your food.
          </p>
          {order.pickupOtpVerifiedAt && (
            <p className="text-[11px] font-bold text-emerald-400 pt-1">
              Verified at: {new Date(order.pickupOtpVerifiedAt).toLocaleString()}
            </p>
          )}
        </Card>
      )}

      {/* Main Order Card */}
      <Card padding="md" className="bg-white border-slate-200 space-y-4">
        {/* Status & Pickup Info */}
        <div className="grid grid-cols-2 gap-3 text-xs">
          <div className="bg-slate-50 border border-slate-200/80 p-3 rounded-2xl space-y-1">
            <span className="text-slate-400 font-semibold flex items-center gap-1">
              <Clock className="w-3.5 h-3.5 text-slate-500" /> Status
            </span>
            <div>{getStatusBadge(order.status)}</div>
            {formattedCancelledDate && (
              <p className="text-[10px] font-semibold text-rose-600 pt-1">
                Cancelled at: {formattedCancelledDate}
              </p>
            )}
          </div>

          <div className="bg-slate-50 border border-slate-200/80 p-3 rounded-2xl space-y-1">
            <span className="text-slate-400 font-semibold flex items-center gap-1">
              <Store className="w-3.5 h-3.5 text-slate-500" /> Pickup Location
            </span>
            <span className="font-bold text-slate-900 block truncate">
              {order.pickupMethod}
            </span>
          </div>
        </div>

        {/* Snapshotted Items List */}
        <div className="space-y-3 pt-2">
          <h2 className="text-xs font-bold text-slate-900 uppercase tracking-wider text-slate-500">
            Ordered Line Items ({items.length})
          </h2>

          <div className="space-y-2.5">
            {items.map((item) => (
              <div
                key={item.id}
                className="flex items-center justify-between gap-3 text-xs py-2 border-b border-slate-100 last:border-0"
              >
                <div className="flex items-center gap-3 min-w-0">
                  <img
                    src={item.imageUrl || DEFAULT_FOOD_IMAGE}
                    alt={item.itemName}
                    className="w-12 h-12 object-cover rounded-xl border border-slate-200 shrink-0 bg-slate-50"
                    onError={(e) => {
                      (e.target as HTMLImageElement).src = DEFAULT_FOOD_IMAGE;
                    }}
                  />
                  <div className="min-w-0">
                    <span className="font-bold text-slate-900 block truncate">{item.itemName}</span>
                    <span className="text-slate-500 text-[11px]">
                      ₹{item.unitPrice} × {item.quantity}
                    </span>
                  </div>
                </div>
                <span className="font-extrabold text-slate-900 shrink-0">
                  ₹{item.lineTotal}
                </span>
              </div>
            ))}
          </div>
        </div>

        {/* Total Amount */}
        <div className="pt-3 border-t border-slate-100 flex items-center justify-between">
          <span className="text-sm font-extrabold text-slate-900">Total Order Amount</span>
          <span className="text-2xl font-black text-rose-600">₹{order.totalAmount}</span>
        </div>
      </Card>

      {/* Confirmation Modal Dialog for Order Cancellation */}
      {showCancelModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center p-4 animate-fadeIn">
          <div className="bg-white border border-slate-200 rounded-3xl p-6 max-w-sm w-full space-y-4 shadow-xl">
            <div className="w-12 h-12 rounded-full bg-rose-100 text-rose-600 flex items-center justify-center mx-auto">
              <AlertTriangle className="w-6 h-6" />
            </div>

            <div className="text-center space-y-1">
              <h3 className="text-base font-bold text-slate-900">
                Cancel Order #{order.orderNumber}?
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
                onClick={() => setShowCancelModal(false)}
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


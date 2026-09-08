import React, { useState, useEffect, useCallback } from 'react';
import { OrderPlacedDetails } from './StudentCheckout';
import { Card } from '../shared/components/Card';
import { Button } from '../shared/components/Button';
import {
  CheckCircle2,
  Clock,
  Store,
  Utensils,
  ListOrdered,
  Sparkles,
  KeyRound,
  Timer,
  Users,
} from 'lucide-react';
import { DEFAULT_FOOD_IMAGE } from '../services/menuService';
import { fetchOrderEta, getConfidenceBadgeStyle } from '../services/orderService';
import { OrderEtaPrediction } from '../types';
import { useAuth } from '../auth/AuthContext';
import { useStudentOrdersRealtime } from '../hooks/useOrderRealtime';

interface OrderConfirmationProps {
  orderDetails: OrderPlacedDetails;
  onViewOrders: () => void;
  onBackToMenu: () => void;
}

export const OrderConfirmation: React.FC<OrderConfirmationProps> = ({
  orderDetails,
  onViewOrders,
  onBackToMenu,
}) => {
  const { user } = useAuth();
  const [eta, setEta] = useState<OrderEtaPrediction | null>(null);

  const loadEta = useCallback(() => {
    if (orderDetails.orderId) {
      fetchOrderEta(orderDetails.orderId)
        .then((res) => setEta(res))
        .catch((err) => console.warn('[OrderConfirmation] ETA fetch failed:', err));
    }
  }, [orderDetails.orderId]);

  useStudentOrdersRealtime(user?.id, loadEta);

  useEffect(() => {
    loadEta();
  }, [loadEta]);

  const formattedDate = new Date().toLocaleString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  });

  return (
    <div className="space-y-6 pb-24 sm:pb-12 max-w-xl mx-auto pt-4 animate-fadeIn">
      {/* Success Badge Banner */}
      <div className="bg-emerald-600 text-white rounded-3xl p-6 text-center space-y-3 shadow-md relative overflow-hidden">
        <div className="absolute -right-6 -bottom-6 w-24 h-24 bg-white/10 rounded-full blur-xl pointer-events-none"></div>
        <div className="w-16 h-16 rounded-full bg-white/20 text-white flex items-center justify-center mx-auto shadow-inner">
          <CheckCircle2 className="w-10 h-10 stroke-[2.5]" />
        </div>
        <div className="space-y-1">
          <div className="inline-flex items-center gap-1 bg-white/20 text-white px-3 py-0.5 rounded-full text-[11px] font-bold uppercase tracking-wider mb-1">
            <Sparkles className="w-3 h-3" /> Order Confirmed
          </div>
          <h1 className="text-2xl font-black tracking-tight">Order Placed Successfully!</h1>
          <p className="text-xs text-emerald-100 font-medium max-w-xs mx-auto">
            Your canteen order has been sent directly to the kitchen preparation queue.
          </p>
        </div>
      </div>

      {/* Dynamic Initial ETA Card */}
      {eta && (
        <Card padding="md" className="bg-white border-2 border-slate-900 shadow-md space-y-3 rounded-3xl">
          <div className="flex items-center justify-between border-b border-slate-100 pb-2">
            <div className="flex items-center gap-2">
              <Timer className="w-5 h-5 text-rose-600" />
              <h2 className="text-sm font-bold text-slate-900">Estimated Preparation Time</h2>
            </div>
            {(() => {
              const style = getConfidenceBadgeStyle(eta.confidenceLevel);
              return (
                <span className={`text-[10px] font-extrabold px-2.5 py-0.5 rounded-full border ${style.bgClass} ${style.borderClass}`}>
                  {style.label}
                </span>
              );
            })()}
          </div>

          <div className="grid grid-cols-2 gap-3 text-center text-xs">
            <div className="bg-slate-50 p-3 rounded-2xl space-y-0.5 border border-slate-100">
              <span className="text-slate-400 font-semibold flex items-center justify-center gap-1">
                <Users className="w-3.5 h-3.5 text-slate-500" /> Queue Status
              </span>
              <span className="font-extrabold text-slate-900 text-sm block">
                {eta.ordersAhead === 0 ? 'Next up' : `${eta.ordersAhead} orders ahead`}
              </span>
            </div>

            <div className="bg-slate-50 p-3 rounded-2xl space-y-0.5 border border-slate-100">
              <span className="text-slate-400 font-semibold flex items-center justify-center gap-1">
                <Clock className="w-3.5 h-3.5 text-slate-500" /> Est. Ready In
              </span>
              <span className="font-black text-rose-600 text-sm block">
                {eta.formattedRange}
              </span>
            </div>
          </div>
        </Card>
      )}

      {/* Prominent Pickup OTP Section */}
      {orderDetails.pickupOtp && (
        <Card padding="md" className="bg-gradient-to-br from-slate-900 to-slate-800 text-white border-2 border-amber-400/80 shadow-lg text-center space-y-2 rounded-3xl">
          <div className="inline-flex items-center gap-1.5 bg-amber-400/20 text-amber-300 px-3 py-0.5 rounded-full text-[11px] font-bold uppercase tracking-wider">
            <KeyRound className="w-3.5 h-3.5" /> Pickup OTP
          </div>
          <div className="text-4xl sm:text-5xl font-black tracking-widest text-amber-400 font-mono py-2 select-all">
            {orderDetails.pickupOtp}
          </div>
          <p className="text-xs font-bold text-slate-200">
            Give this 4-digit code to the canteen worker when collecting your order.
          </p>
          <p className="text-[11px] text-slate-400 font-medium">
            Keep this code private until pickup.
          </p>
        </Card>
      )}

      {/* Main Order Details Card */}
      <Card padding="md" className="bg-white border-slate-200 space-y-4">
        {/* Order Number & Timestamp Header */}
        <div className="flex items-center justify-between pb-3 border-b border-slate-100">
          <div>
            <span className="text-[11px] text-slate-400 font-semibold uppercase tracking-wider block">
              Order Reference
            </span>
            <span className="text-xl font-extrabold text-slate-900">
              #{orderDetails.orderNumber}
            </span>
          </div>
          <div className="text-right">
            <span className="text-[11px] text-slate-400 font-semibold uppercase tracking-wider block">
              Date & Time
            </span>
            <span className="text-xs font-bold text-slate-700">{formattedDate}</span>
          </div>
        </div>

        {/* Status & Pickup Attributes */}
        <div className="grid grid-cols-2 gap-3 text-xs">
          <div className="bg-slate-50 border border-slate-200/80 p-3 rounded-2xl space-y-1">
            <span className="text-slate-400 font-semibold flex items-center gap-1">
              <Clock className="w-3.5 h-3.5 text-slate-500" /> Current Status
            </span>
            <span className="font-extrabold text-amber-900 bg-amber-100 border border-amber-300 px-2 py-0.5 rounded-md inline-block text-[11px] uppercase">
              Placed
            </span>
          </div>

          <div className="bg-slate-50 border border-slate-200/80 p-3 rounded-2xl space-y-1">
            <span className="text-slate-400 font-semibold flex items-center gap-1">
              <Store className="w-3.5 h-3.5 text-slate-500" /> Pickup Location
            </span>
            <span className="font-bold text-slate-900 block truncate">
              {orderDetails.pickupLocationName || 'Canteen Counter'}
            </span>
          </div>
        </div>

        {/* Ordered Items List */}
        <div className="space-y-2.5 pt-2">
          <span className="text-xs font-bold text-slate-900 block">Summary of Ordered Items</span>
          <div className="space-y-2">
            {orderDetails.items.map((item) => (
              <div
                key={item.id}
                className="flex items-center justify-between gap-3 text-xs py-1.5 border-b border-slate-100 last:border-0"
              >
                <div className="flex items-center gap-2 min-w-0">
                  <img
                    src={item.imageUrl || DEFAULT_FOOD_IMAGE}
                    alt={item.name}
                    className="w-10 h-10 object-cover rounded-lg border border-slate-200 shrink-0"
                    onError={(e) => {
                      (e.target as HTMLImageElement).src = DEFAULT_FOOD_IMAGE;
                    }}
                  />
                  <div className="min-w-0">
                    <span className="font-bold text-slate-900 block truncate">{item.name}</span>
                    <span className="text-slate-500 text-[11px]">Qty: {item.quantity} × ₹{item.price}</span>
                  </div>
                </div>
                <span className="font-extrabold text-slate-900 shrink-0">
                  ₹{item.price * item.quantity}
                </span>
              </div>
            ))}
          </div>
        </div>

        {/* Final Total Amount */}
        <div className="pt-3 border-t border-slate-100 flex items-center justify-between">
          <span className="text-sm font-extrabold text-slate-900">Total Amount Paid/Due</span>
          <span className="text-2xl font-black text-rose-600">₹{orderDetails.totalAmount}</span>
        </div>
      </Card>

      {/* Action Buttons */}
      <div className="space-y-2">
        <Button
          variant="primary"
          size="lg"
          onClick={onViewOrders}
          leftIcon={<ListOrdered className="w-4 h-4" />}
          className="w-full py-3"
        >
          View My Orders
        </Button>

        <Button
          variant="outline"
          size="sm"
          onClick={onBackToMenu}
          leftIcon={<Utensils className="w-4 h-4" />}
          className="w-full py-2.5"
        >
          Back to Food Menu
        </Button>
      </div>
    </div>
  );
};

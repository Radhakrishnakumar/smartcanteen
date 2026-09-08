import React, { useEffect, useState } from 'react';
import { useCart } from '../contexts/CartContext';
import { Card } from '../shared/components/Card';
import { Button } from '../shared/components/Button';
import {
  ShoppingBag,
  Plus,
  Minus,
  Trash2,
  AlertTriangle,
  ArrowRight,
  Utensils,
} from 'lucide-react';
import { fetchMenuItems, MenuItem, DEFAULT_FOOD_IMAGE } from '../services/menuService';

interface StudentCartProps {
  onNavigateToMenu?: () => void;
  onProceedToCheckout?: () => void;
}

export const StudentCart: React.FC<StudentCartProps> = ({ onNavigateToMenu, onProceedToCheckout }) => {
  const { items, updateQuantity, removeFromCart, totalCount, subtotal } = useCart();
  const [liveMenu, setLiveMenu] = useState<MenuItem[]>([]);
  const [loadingReconciliation, setLoadingReconciliation] = useState<boolean>(true);

  // Reconcile cart items with live database menu items
  useEffect(() => {
    let isMounted = true;
    fetchMenuItems(true)
      .then((data) => {
        if (isMounted) {
          setLiveMenu(data);
          setLoadingReconciliation(false);
        }
      })
      .catch((err) => {
        console.warn('[StudentCart] Failed to fetch live menu for reconciliation:', err);
        if (isMounted) setLoadingReconciliation(false);
      });

    return () => {
      isMounted = false;
    };
  }, []);

  // Map item availability from live menu database
  const getUnavailabilityStatus = (cartItemId: string): { unavailable: boolean; reason?: string } => {
    if (loadingReconciliation || liveMenu.length === 0) {
      return { unavailable: false };
    }

    const liveItem = liveMenu.find((m) => m.id === cartItemId);
    if (!liveItem) {
      return { unavailable: true, reason: 'Item no longer exists in canteen database' };
    }

    if (!liveItem.isActive) {
      return { unavailable: true, reason: 'Item removed from canteen menu' };
    }

    if (!liveItem.isAvailable) {
      return { unavailable: true, reason: 'Currently Out of Stock' };
    }

    return { unavailable: false };
  };

  // Calculate available subtotal (excluding unavailable items)
  const availableSubtotal = items.reduce((sum, item) => {
    const status = getUnavailabilityStatus(item.id);
    if (status.unavailable) return sum;
    return sum + item.price * item.quantity;
  }, 0);

  const hasUnavailableItems = items.some((item) => getUnavailabilityStatus(item.id).unavailable);

  const handleCheckoutClick = () => {
    if (hasUnavailableItems) {
      alert('Please remove unavailable or out-of-stock items from your cart before proceeding to checkout.');
      return;
    }
    if (onProceedToCheckout) {
      onProceedToCheckout();
    }
  };

  if (items.length === 0) {
    return (
      <div className="bg-white border border-slate-200 rounded-3xl p-8 text-center space-y-4 shadow-xs max-w-md mx-auto my-6">
        <div className="w-16 h-16 rounded-full bg-rose-50 text-rose-600 flex items-center justify-center mx-auto">
          <ShoppingBag className="w-8 h-8" />
        </div>
        <div className="space-y-1">
          <h2 className="text-lg font-bold text-slate-900">Your cart is empty.</h2>
          <p className="text-xs text-slate-500 max-w-xs mx-auto leading-relaxed">
            Explore our fresh campus canteen food menu and add your favorite dishes to your cart.
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
            Browse Menu
          </Button>
        )}
      </div>
    );
  }

  return (
    <div className="space-y-5 pb-24 sm:pb-12 max-w-2xl mx-auto">
      {/* Cart Title & Item Count Header */}
      <div className="flex items-center justify-between pt-2">
        <div>
          <h1 className="text-xl font-extrabold text-slate-900 tracking-tight">Shopping Cart</h1>
          <p className="text-xs text-slate-500 font-medium mt-0.5">
            Review your selected food items before ordering
          </p>
        </div>
        <div className="bg-rose-600 text-white px-3.5 py-1.5 rounded-full text-xs font-bold shadow-xs">
          {totalCount} {totalCount === 1 ? 'item' : 'items'}
        </div>
      </div>

      {/* Warning Banner if Cart contains items marked Out of Stock or Removed */}
      {hasUnavailableItems && (
        <div className="bg-amber-50 border border-amber-200 text-amber-800 text-xs font-medium p-3.5 rounded-2xl flex items-start gap-2.5 shadow-xs">
          <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
          <div className="space-y-0.5">
            <span className="font-bold block">Notice: Unavailable items in cart</span>
            <span>
              Some items in your cart have been marked Out of Stock or Removed by the canteen. Please remove them to proceed cleanly.
            </span>
          </div>
        </div>
      )}

      {/* Cart Line Items List */}
      <div className="space-y-3">
        {items.map((item) => {
          const lineTotal = item.price * item.quantity;
          const status = getUnavailabilityStatus(item.id);
          const isUnavailable = status.unavailable;

          return (
            <Card
              key={item.id}
              padding="sm"
              className={`bg-white border-slate-200 transition-all ${
                isUnavailable ? 'border-amber-200 bg-amber-50/30' : ''
              }`}
            >
              <div className="flex items-center justify-between gap-3">
                {/* Food Image Thumbnail */}
                <img
                  src={item.imageUrl || DEFAULT_FOOD_IMAGE}
                  alt={item.name}
                  className={`w-16 h-16 object-cover rounded-xl border border-slate-200 shrink-0 ${
                    isUnavailable ? 'grayscale opacity-70 bg-slate-100' : 'bg-slate-50'
                  }`}
                  onError={(e) => {
                    (e.target as HTMLImageElement).src = DEFAULT_FOOD_IMAGE;
                  }}
                />

                {/* Item Info */}
                <div className="flex-1 min-w-0 space-y-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <h3 className="text-sm font-bold text-slate-900 truncate">{item.name}</h3>
                    <span className="text-[10px] font-semibold text-slate-600 bg-slate-100 px-2 py-0.5 rounded-md shrink-0">
                      {item.category}
                    </span>
                  </div>

                  {isUnavailable ? (
                    <span className="inline-flex items-center gap-1 text-[11px] font-bold text-amber-700 bg-amber-100 px-2 py-0.5 rounded-md">
                      <AlertTriangle className="w-3 h-3" />
                      {status.reason || 'Currently Unavailable'}
                    </span>
                  ) : (
                    <p className="text-xs text-slate-500 font-medium">
                      ₹{item.price} per item
                    </p>
                  )}
                </div>

                {/* Price Line Total & Actions */}
                <div className="flex flex-col items-end gap-2 shrink-0">
                  <p className="text-sm font-extrabold text-slate-900">₹{lineTotal}</p>

                  <div className="flex items-center gap-2">
                    {/* Quantity Control Buttons */}
                    <div className="flex items-center gap-1 bg-slate-100 border border-slate-200 p-0.5 rounded-xl">
                      <button
                        onClick={() => updateQuantity(item.id, item.quantity - 1)}
                        disabled={item.quantity <= 1 || isUnavailable}
                        title="Decrease Quantity"
                        className="w-6 h-6 rounded-lg bg-white text-slate-700 hover:bg-slate-200 disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center text-xs font-bold shadow-2xs transition-colors"
                      >
                        <Minus className="w-3 h-3" />
                      </button>
                      <span className="w-6 text-center text-xs font-bold text-slate-900">
                        {item.quantity}
                      </span>
                      <button
                        onClick={() => updateQuantity(item.id, item.quantity + 1)}
                        disabled={isUnavailable}
                        title="Increase Quantity"
                        className="w-6 h-6 rounded-lg bg-white text-slate-700 hover:bg-slate-200 disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center text-xs font-bold shadow-2xs transition-colors"
                      >
                        <Plus className="w-3 h-3" />
                      </button>
                    </div>

                    {/* Remove Item Button */}
                    <button
                      onClick={() => removeFromCart(item.id)}
                      title="Remove item from cart"
                      className="p-1.5 rounded-xl text-slate-400 hover:text-red-600 hover:bg-red-50 transition-colors"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              </div>
            </Card>
          );
        })}
      </div>

      {/* Cart Subtotal Summary Card & Checkout Actions */}
      <Card className="bg-white border-slate-200 p-5 space-y-3">
        <div className="flex items-center justify-between pb-3 border-b border-slate-100">
          <span className="text-xs font-semibold text-slate-500">Total Unique Items</span>
          <span className="text-xs font-bold text-slate-900">{items.length}</span>
        </div>
        <div className="flex items-center justify-between pb-3 border-b border-slate-100">
          <span className="text-xs font-semibold text-slate-500">Total Quantity</span>
          <span className="text-xs font-bold text-slate-900">{totalCount} items</span>
        </div>
        <div className="flex items-center justify-between pt-1">
          <div>
            <span className="text-base font-extrabold text-slate-900 block">Subtotal</span>
            <span className="text-[11px] text-slate-400 font-medium">Excludes taxes or fees</span>
          </div>
          <span className="text-2xl font-black text-rose-600">₹{availableSubtotal || subtotal}</span>
        </div>

        {/* Proceed to Checkout Primary Action Button */}
        {onProceedToCheckout && (
          <Button
            variant="primary"
            size="lg"
            onClick={handleCheckoutClick}
            disabled={hasUnavailableItems}
            rightIcon={<ArrowRight className="w-4 h-4" />}
            className="w-full mt-3 py-3"
          >
            Proceed to Checkout
          </Button>
        )}

        {onNavigateToMenu && (
          <Button
            variant="outline"
            size="sm"
            onClick={onNavigateToMenu}
            leftIcon={<Utensils className="w-4 h-4" />}
            className="w-full mt-2"
          >
            Continue Browsing Menu
          </Button>
        )}
      </Card>
    </div>
  );
};


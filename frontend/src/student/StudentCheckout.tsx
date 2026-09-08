import React, { useState, useEffect, useCallback } from 'react';
import { useCart, CartItem } from '../contexts/CartContext';
import { Card } from '../shared/components/Card';
import { Button } from '../shared/components/Button';
import {
  ArrowLeft,
  ShoppingBag,
  ShieldCheck,
  AlertCircle,
  Loader2,
  CheckCircle2,
  MapPin,
  Check,
  Trash2,
  RefreshCw,
  AlertTriangle,
} from 'lucide-react';
import { fetchMenuItems, MenuItem, DEFAULT_FOOD_IMAGE } from '../services/menuService';
import { placeStudentOrder, fetchActivePickupLocations } from '../services/orderService';
import { PickupLocation } from '../types';

export interface OrderPlacedDetails {
  orderId: string;
  orderNumber: number;
  totalAmount: number;
  pickupOtp?: string;
  items: CartItem[];
  pickupLocationName?: string;
}

interface StudentCheckoutProps {
  onBackToCart: () => void;
  onOrderPlaced: (details: OrderPlacedDetails) => void;
}

export const StudentCheckout: React.FC<StudentCheckoutProps> = ({
  onBackToCart,
  onOrderPlaced,
}) => {
  const { items, subtotal, clearCart, removeFromCart } = useCart();
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [revalidating, setRevalidating] = useState<boolean>(true);
  
  // Track invalid item reasons per cart item ID
  const [invalidItemsMap, setInvalidItemsMap] = useState<Map<string, string>>(new Map());

  const [pickupLocations, setPickupLocations] = useState<PickupLocation[]>([]);
  const [selectedLocationId, setSelectedLocationId] = useState<string | null>(null);
  const [loadingLocations, setLoadingLocations] = useState<boolean>(true);
  const [locationError, setLocationError] = useState<string | null>(null);

  // Fetch active pickup locations
  const loadLocations = useCallback(async () => {
    setLoadingLocations(true);
    setLocationError(null);
    try {
      const locs = await fetchActivePickupLocations();
      setPickupLocations(locs);
      if (locs.length === 0) {
        setLocationError('No active pickup locations are currently configured in the system.');
      }
    } catch (err) {
      console.warn('[StudentCheckout] Failed to load pickup locations:', err);
      setLocationError('Unable to load pickup locations. Please check your connection.');
    } finally {
      setLoadingLocations(false);
    }
  }, []);

  // Fetch active pickup locations & live menu revalidation on checkout screen mount
  useEffect(() => {
    let isMounted = true;

    loadLocations();

    // Revalidate menu items availability
    setRevalidating(true);
    fetchMenuItems(true)
      .then((liveMenu: MenuItem[]) => {
        if (!isMounted) return;
        setRevalidating(false);

        const newInvalidMap = new Map<string, string>();
        for (const item of items) {
          const live = liveMenu.find((m) => m.id === item.id);
          if (!live) {
            newInvalidMap.set(item.id, `"${item.name}" no longer exists in the canteen menu database.`);
          } else if (!live.isActive) {
            newInvalidMap.set(item.id, `"${item.name}" has been removed from the menu by canteen staff.`);
          } else if (!live.isAvailable) {
            newInvalidMap.set(item.id, `"${item.name}" is currently Out of Stock.`);
          }
        }
        setInvalidItemsMap(newInvalidMap);
      })
      .catch((err) => {
        console.warn('[StudentCheckout] Live menu revalidation warning:', err);
        if (isMounted) setRevalidating(false);
      });

    return () => {
      isMounted = false;
    };
  }, [items, loadLocations]);

  // Remove all invalid items from cart in one click
  const handleRemoveInvalidItems = () => {
    for (const [itemId] of invalidItemsMap.entries()) {
      removeFromCart(itemId);
    }
    setInvalidItemsMap(new Map());
    setErrorMessage(null);
  };

  const hasInvalidItems = invalidItemsMap.size > 0;

  // Calculate subtotal of valid items only
  const validSubtotal = items.reduce((sum, item) => {
    if (invalidItemsMap.has(item.id)) return sum;
    return sum + item.price * item.quantity;
  }, 0);

  const handlePlaceOrder = async () => {
    if (isSubmitting || revalidating) return;

    if (hasInvalidItems) {
      setErrorMessage('Your cart contains unavailable food items. Please update your cart before placing an order.');
      return;
    }

    if (items.length === 0) {
      setErrorMessage('Your cart is empty.');
      return;
    }

    if (!selectedLocationId) {
      setErrorMessage('Please select a pickup location.');
      return;
    }

    setIsSubmitting(true);
    setErrorMessage(null);

    const selectedLoc = pickupLocations.find((l) => l.id === selectedLocationId);

    const result = await placeStudentOrder(items, selectedLocationId);

    if (result.success && result.orderId && result.orderNumber) {
      const orderDetails: OrderPlacedDetails = {
        orderId: result.orderId,
        orderNumber: result.orderNumber,
        totalAmount: result.totalAmount || subtotal,
        pickupOtp: result.pickupOtp,
        items: [...items],
        pickupLocationName: selectedLoc?.name,
      };
      clearCart();
      setIsSubmitting(false);
      onOrderPlaced(orderDetails);
    } else {
      setIsSubmitting(false);
      setErrorMessage(result.error || 'Failed to place order. Please try again.');
    }
  };

  if (items.length === 0) {
    return (
      <div className="bg-white border border-slate-200 rounded-3xl p-8 text-center space-y-4 shadow-xs max-w-md mx-auto my-6">
        <div className="w-16 h-16 rounded-full bg-slate-100 text-slate-500 flex items-center justify-center mx-auto">
          <ShoppingBag className="w-8 h-8" />
        </div>
        <h2 className="text-lg font-bold text-slate-900">No items in checkout</h2>
        <Button variant="outline" size="sm" onClick={onBackToCart}>
          Back to Cart
        </Button>
      </div>
    );
  }

  const selectedLocName = pickupLocations.find((l) => l.id === selectedLocationId)?.name;

  return (
    <div className="space-y-6 pb-24 sm:pb-12 max-w-2xl mx-auto">
      {/* Header & Back Action */}
      <div className="flex items-center gap-3 pt-2">
        <button
          onClick={onBackToCart}
          className="p-2 rounded-xl bg-white border border-slate-200 text-slate-600 hover:text-slate-900 transition-colors shadow-xs"
          title="Back to Cart"
        >
          <ArrowLeft className="w-5 h-5" />
        </button>
        <div>
          <h1 className="text-xl font-extrabold text-slate-900 tracking-tight">Review & Place Order</h1>
          <p className="text-xs text-slate-500 font-medium mt-0.5">
            Verify your canteen order items and select your pickup location
          </p>
        </div>
      </div>

      {/* Error Message Banner */}
      {errorMessage && (
        <div className="bg-rose-50 border border-rose-200 text-rose-800 text-xs font-semibold p-4 rounded-2xl flex items-start gap-3 shadow-xs">
          <AlertCircle className="w-5 h-5 text-rose-600 shrink-0 mt-0.5" />
          <div className="space-y-1">
            <span className="font-bold block text-rose-900">Order Action Required</span>
            <span>{errorMessage}</span>
          </div>
        </div>
      )}

      {/* Revalidation Warning Notice Banner for Invalid Items */}
      {hasInvalidItems && (
        <div className="bg-amber-50 border border-amber-300 text-amber-950 text-xs font-medium p-4.5 rounded-2xl space-y-3 shadow-xs">
          <div className="flex items-start gap-3">
            <AlertTriangle className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
            <div className="space-y-1 flex-1">
              <span className="font-bold block text-sm text-amber-950">
                Item Availability Notice — Action Required
              </span>
              <p className="text-xs text-amber-900 leading-relaxed font-medium">
                The following item(s) in your cart are no longer available in the canteen system:
              </p>
              <ul className="list-disc pl-4 space-y-0.5 text-xs text-amber-900 pt-1 font-semibold">
                {Array.from(invalidItemsMap.values()).map((reason, idx) => (
                  <li key={idx}>{reason}</li>
                ))}
              </ul>
            </div>
          </div>

          <div className="pt-2 border-t border-amber-200/70 flex flex-wrap items-center gap-2 justify-end">
            <Button
              variant="outline"
              size="sm"
              onClick={onBackToCart}
              leftIcon={<ArrowLeft className="w-3.5 h-3.5" />}
              className="bg-white border-amber-300 text-amber-900 hover:bg-amber-100/50"
            >
              Back to Cart
            </Button>
            <Button
              variant="primary"
              size="sm"
              onClick={handleRemoveInvalidItems}
              leftIcon={<Trash2 className="w-3.5 h-3.5 text-white" />}
              className="bg-amber-700 hover:bg-amber-800 text-white font-bold"
            >
              Remove Unavailable Items
            </Button>
          </div>
        </div>
      )}

      {/* Pickup Location Selection Card */}
      <Card padding="md" className="bg-white border-slate-200 space-y-4">
        <div className="flex items-center justify-between pb-2 border-b border-slate-100">
          <div className="flex items-center gap-2">
            <MapPin className="w-5 h-5 text-rose-600" />
            <div>
              <h2 className="text-sm font-bold text-slate-900">Select Pickup Location</h2>
              <p className="text-xs text-slate-500 font-medium">Choose where you want to collect your order</p>
            </div>
          </div>
          {locationError && (
            <button
              type="button"
              onClick={loadLocations}
              className="text-xs font-bold text-rose-600 hover:text-rose-800 flex items-center gap-1"
            >
              <RefreshCw className="w-3.5 h-3.5" />
              Retry
            </button>
          )}
        </div>

        {loadingLocations ? (
          <div className="flex items-center justify-center py-6 text-xs text-slate-500 gap-2">
            <Loader2 className="w-4 h-4 animate-spin text-rose-600" />
            Loading pickup locations...
          </div>
        ) : locationError || pickupLocations.length === 0 ? (
          <div className="bg-slate-50 border border-slate-200 rounded-2xl p-4 text-center space-y-3">
            <div className="text-xs text-slate-600 font-medium">
              {locationError || 'No active pickup locations are available right now.'}
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={loadLocations}
              leftIcon={<RefreshCw className="w-3.5 h-3.5" />}
            >
              Retry Loading Locations
            </Button>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {pickupLocations.map((loc) => {
              const isSelected = selectedLocationId === loc.id;
              return (
                <button
                  key={loc.id}
                  type="button"
                  onClick={() => {
                    setSelectedLocationId(loc.id);
                    setErrorMessage(null);
                  }}
                  className={`p-4 rounded-2xl border text-left transition-all relative flex flex-col justify-between ${
                    isSelected
                      ? 'border-rose-600 bg-rose-50/50 shadow-xs'
                      : 'border-slate-200 bg-white hover:border-slate-300 hover:bg-slate-50/50'
                  }`}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-center gap-2.5">
                      <div
                        className={`w-5 h-5 rounded-full border flex items-center justify-center shrink-0 ${
                          isSelected
                            ? 'border-rose-600 bg-rose-600 text-white'
                            : 'border-slate-300 bg-white'
                        }`}
                      >
                        {isSelected && <Check className="w-3.5 h-3.5 stroke-[3]" />}
                      </div>
                      <span className="font-bold text-sm text-slate-900">{loc.name}</span>
                    </div>
                  </div>
                  {loc.description && (
                    <p className="text-xs text-slate-500 font-normal mt-2 pl-7">{loc.description}</p>
                  )}
                </button>
              );
            })}
          </div>
        )}
      </Card>

      {/* Order Summary & Line Items List */}
      <div className="space-y-3">
        <h2 className="text-sm font-bold text-slate-900 px-1">Order Items ({items.length})</h2>

        {items.map((item) => {
          const lineTotal = item.price * item.quantity;
          const invalidReason = invalidItemsMap.get(item.id);

          return (
            <Card
              key={item.id}
              padding="sm"
              className={`bg-white border-slate-200 transition-all ${
                invalidReason ? 'bg-amber-50/40 border-amber-300' : ''
              }`}
            >
              <div className="flex items-center gap-3">
                <img
                  src={item.imageUrl || DEFAULT_FOOD_IMAGE}
                  alt={item.name}
                  className={`w-14 h-14 object-cover rounded-xl border shrink-0 ${
                    invalidReason
                      ? 'grayscale opacity-60 border-amber-200 bg-amber-50'
                      : 'border-slate-100 bg-slate-50'
                  }`}
                  onError={(e) => {
                    (e.target as HTMLImageElement).src = DEFAULT_FOOD_IMAGE;
                  }}
                />
                <div className="flex-1 min-w-0 space-y-0.5">
                  <div className="flex items-center gap-2 flex-wrap">
                    <h3 className="text-sm font-bold text-slate-900 truncate">{item.name}</h3>
                  </div>

                  {invalidReason ? (
                    <span className="inline-flex items-center gap-1 text-[11px] font-bold text-amber-800 bg-amber-100 border border-amber-200 px-2 py-0.5 rounded-md mt-1">
                      <AlertCircle className="w-3.5 h-3.5 text-amber-600 shrink-0" />
                      {invalidReason}
                    </span>
                  ) : (
                    <p className="text-xs text-slate-500 font-medium">
                      ₹{item.price} × {item.quantity}
                    </p>
                  )}
                </div>
                <div className="text-right shrink-0">
                  <span
                    className={`text-sm font-extrabold ${
                      invalidReason ? 'text-slate-400 line-through' : 'text-slate-900'
                    }`}
                  >
                    ₹{lineTotal}
                  </span>
                </div>
              </div>
            </Card>
          );
        })}
      </div>

      {/* Total & Final Submission Card */}
      <Card padding="md" className="bg-white border-slate-200 space-y-4">
        <div className="space-y-2 text-xs">
          <div className="flex items-center justify-between text-slate-600">
            <span>Pickup Location</span>
            <span
              className={`font-bold ${
                selectedLocName
                  ? 'text-slate-900 bg-rose-50 text-rose-700 px-2 py-0.5 rounded-md border border-rose-100'
                  : 'text-slate-400 italic'
              }`}
            >
              {selectedLocName || 'Not Selected'}
            </span>
          </div>
          <div className="flex items-center justify-between text-slate-600">
            <span>Cart Subtotal</span>
            <span className="font-bold text-slate-900">₹{subtotal}</span>
          </div>
          {hasInvalidItems && (
            <div className="flex items-center justify-between text-xs font-semibold text-amber-800 bg-amber-50 p-2 rounded-xl border border-amber-200">
              <span>Valid Available Items Total</span>
              <span className="font-extrabold text-amber-950">₹{validSubtotal}</span>
            </div>
          )}
          <div className="flex items-center justify-between text-slate-600">
            <span>Taxes & Fees</span>
            <span className="font-semibold text-emerald-600">₹0.00 (Included)</span>
          </div>
          <div className="pt-2 border-t border-slate-100 flex items-center justify-between">
            <span className="text-base font-extrabold text-slate-900">Total Amount</span>
            <span className={`text-2xl font-black ${hasInvalidItems ? 'text-slate-400 line-through' : 'text-rose-600'}`}>
              ₹{subtotal}
            </span>
          </div>
        </div>

        <div className="flex items-center gap-2 text-[11px] text-slate-500 bg-slate-50 p-3 rounded-xl border border-slate-200/80">
          <ShieldCheck className="w-4 h-4 text-emerald-600 shrink-0" />
          <span>Database price verification active. Order stored securely upon confirmation.</span>
        </div>

        {/* Place Order CTA Button */}
        <Button
          variant="primary"
          size="lg"
          onClick={handlePlaceOrder}
          disabled={isSubmitting || revalidating || hasInvalidItems || !selectedLocationId || loadingLocations}
          leftIcon={
            isSubmitting ? (
              <Loader2 className="w-5 h-5 animate-spin" />
            ) : hasInvalidItems ? (
              <AlertTriangle className="w-5 h-5 text-amber-200" />
            ) : (
              <CheckCircle2 className="w-5 h-5" />
            )
          }
          className={`w-full py-3.5 ${
            hasInvalidItems
              ? 'bg-slate-400 hover:bg-slate-400 text-white cursor-not-allowed shadow-none border-none'
              : ''
          }`}
        >
          {isSubmitting
            ? 'Creating Order...'
            : hasInvalidItems
            ? 'Checkout Blocked — Update Cart'
            : `Place Order • ₹${subtotal}`}
        </Button>
      </Card>
    </div>
  );
};



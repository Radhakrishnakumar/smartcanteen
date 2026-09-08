import React, { useState, useEffect, useCallback } from 'react';
import { Order, PickupLocation } from '../types';
import { fetchWorkerOrders, updateOrderStatusByWorker, verifyPickupOtp, fetchActivePickupLocations } from '../services/orderService';
import { useWorkerOrdersRealtime } from '../hooks/useOrderRealtime';
import { Card } from '../shared/components/Card';
import { Button } from '../shared/components/Button';
import { EmptyState } from '../shared/components/EmptyState';
import {
  ChefHat,
  Clock,
  RefreshCw,
  Loader2,
  AlertCircle,
  CheckCircle,
  CheckCheck,
  Store,
  ChevronLeft,
  ChevronRight,
  KeyRound,
  Radio,
  MapPin,
} from 'lucide-react';
import { DEFAULT_FOOD_IMAGE } from '../services/menuService';

const PAGE_SIZE = 10;

export const WorkerOrders: React.FC = () => {
  const [orders, setOrders] = useState<Order[]>([]);
  const [locations, setLocations] = useState<PickupLocation[]>([]);
  const [selectedLocationId, setSelectedLocationId] = useState<string>('all');
  const [loading, setLoading] = useState<boolean>(true);
  const [filterStatus, setFilterStatus] = useState<string>('all');
  const [currentPage, setCurrentPage] = useState<number>(1);
  const [updatingOrderId, setUpdatingOrderId] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  // OTP Verification Modal state
  const [verifyModalOrder, setVerifyModalOrder] = useState<Order | null>(null);
  const [otpInput, setOtpInput] = useState<string>('');
  const [isVerifyingOtp, setIsVerifyingOtp] = useState<boolean>(false);
  const [otpError, setOtpError] = useState<string | null>(null);

  // Load active pickup locations dynamically
  const loadLocations = useCallback(async () => {
    try {
      const locs = await fetchActivePickupLocations();
      setLocations(locs);
    } catch (err) {
      console.warn('[WorkerOrders] Error loading pickup locations:', err);
    }
  }, []);

  const loadOrders = useCallback(async (showFullSpinner = true) => {
    if (showFullSpinner) setLoading(true);
    setErrorMessage(null);
    try {
      const data = await fetchWorkerOrders();
      setOrders(data);
    } catch (err) {
      console.error('[WorkerOrders] Error loading worker orders:', err);
      setErrorMessage('Failed to fetch kitchen orders queue.');
    } finally {
      if (showFullSpinner) setLoading(false);
    }
  }, []);

  const handleRealtimeChange = useCallback(() => {
    loadOrders(false);
  }, [loadOrders]);

  const { status: realtimeStatus } = useWorkerOrdersRealtime(handleRealtimeChange);

  useEffect(() => {
    loadLocations();
    loadOrders(true);

    // 25-second lightweight safety net fallback polling
    const interval = setInterval(() => {
      loadOrders(false);
    }, 25000);

    return () => clearInterval(interval);
  }, [loadLocations, loadOrders]);

  // Filter orders by selected pickup location first
  const locationFilteredOrders = orders.filter((order) => {
    if (selectedLocationId === 'all') return true;
    return order.pickupLocationId === selectedLocationId;
  });

  // Filter orders by selected status tab within the location-filtered set
  const filteredOrders = locationFilteredOrders.filter((order) => {
    if (filterStatus === 'all') return true;
    return order.status.toLowerCase() === filterStatus;
  });

  // Sort orders for optimal kitchen operations
  // For active statuses ('placed', 'ready'): Oldest First (FIFO) so earlier student orders get served first
  // For terminal statuses ('delivered', 'cancelled'): Newest First (recent history)
  // For 'all': Active orders (oldest first) placed before terminal orders (newest first)
  const sortedOrders = [...filteredOrders].sort((a, b) => {
    const timeA = new Date(a.createdAt).getTime();
    const timeB = new Date(b.createdAt).getTime();

    const activeStatuses = ['placed', 'ready'];
    const isActiveA = activeStatuses.includes(a.status.toLowerCase());
    const isActiveB = activeStatuses.includes(b.status.toLowerCase());

    if (filterStatus === 'all') {
      if (isActiveA && !isActiveB) return -1;
      if (!isActiveA && isActiveB) return 1;
      if (isActiveA && isActiveB) return timeA - timeB; // FIFO oldest first
      return timeB - timeA; // History newest first
    }

    if (activeStatuses.includes(filterStatus)) {
      return timeA - timeB; // FIFO oldest first
    }

    return timeB - timeA; // History newest first
  });

  // Calculate pagination boundaries
  const totalOrdersCount = sortedOrders.length;
  const totalPages = Math.max(1, Math.ceil(totalOrdersCount / PAGE_SIZE));

  // Automatically adjust current page if out of bounds after filtering or status transition
  useEffect(() => {
    if (currentPage > totalPages) {
      setCurrentPage(totalPages);
    }
  }, [totalOrdersCount, totalPages, currentPage]);

  // Handle status tab changes
  const handleFilterChange = (statusKey: string) => {
    setFilterStatus(statusKey);
    setCurrentPage(1);
  };

  // Execute status update via secure Supabase RPC (placed -> ready)
  const handleStatusTransition = async (orderId: string, nextStatus: string) => {
    if (updatingOrderId) return;

    setUpdatingOrderId(orderId);
    setErrorMessage(null);

    const result = await updateOrderStatusByWorker(orderId, nextStatus);

    if (result.success) {
      setUpdatingOrderId(null);
      await loadOrders();
    } else {
      setUpdatingOrderId(null);
      setErrorMessage(result.error || 'Failed to update order status. Please try again.');
    }
  };

  // OTP Verification Modal Handlers
  const handleOpenVerifyModal = (order: Order) => {
    setVerifyModalOrder(order);
    setOtpInput('');
    setOtpError(null);
  };

  const handleCloseVerifyModal = () => {
    if (isVerifyingOtp) return;
    setVerifyModalOrder(null);
    setOtpInput('');
    setOtpError(null);
  };

  const handleOtpInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value.replace(/\D/g, '').slice(0, 4);
    setOtpInput(value);
    setOtpError(null);
  };

  const handleVerifySubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!verifyModalOrder || isVerifyingOtp) return;

    if (otpInput.length !== 4) {
      setOtpError('OTP must be exactly 4 numeric digits.');
      return;
    }

    setIsVerifyingOtp(true);
    setOtpError(null);

    const result = await verifyPickupOtp(verifyModalOrder.id, otpInput);

    if (result.success) {
      setIsVerifyingOtp(false);
      setVerifyModalOrder(null);
      setOtpInput('');
      setSuccessMessage(`Pickup verified. Order #${verifyModalOrder.orderNumber} delivered.`);
      await loadOrders();
    } else {
      setIsVerifyingOtp(false);
      setOtpError(result.error || 'Invalid pickup OTP.');
    }
  };

  const handleLocationFilterChange = (locId: string) => {
    setSelectedLocationId(locId);
    setCurrentPage(1);
  };

  const getStatusCount = (statusKey: string) => {
    if (statusKey === 'all') return locationFilteredOrders.length;
    return locationFilteredOrders.filter((o) => o.status.toLowerCase() === statusKey).length;
  };

  // Extract current 10-order page slice
  const startIndex = (currentPage - 1) * PAGE_SIZE;
  const endIndex = Math.min(startIndex + PAGE_SIZE, totalOrdersCount);
  const currentOrdersPage = sortedOrders.slice(startIndex, startIndex + PAGE_SIZE);

  const getStatusBadge = (status: string) => {
    switch (status.toLowerCase()) {
      case 'placed':
        return (
          <span className="bg-amber-100 text-amber-900 border border-amber-300 font-extrabold px-3 py-1 rounded-lg text-xs uppercase tracking-wide">
            New Placed
          </span>
        );
      case 'ready':
        return (
          <span className="bg-blue-100 text-blue-800 border border-blue-300 font-extrabold px-3 py-1 rounded-lg text-xs uppercase tracking-wide">
            Ready for Pickup
          </span>
        );
      case 'delivered':
        return (
          <span className="bg-emerald-100 text-emerald-800 border border-emerald-300 font-extrabold px-3 py-1 rounded-lg text-xs uppercase tracking-wide">
            Delivered
          </span>
        );
      case 'cancelled':
        return (
          <span className="bg-rose-100 text-rose-800 border border-rose-300 font-extrabold px-3 py-1 rounded-lg text-xs uppercase tracking-wide">
            Cancelled
          </span>
        );
      default:
        return (
          <span className="bg-slate-100 text-slate-700 border border-slate-300 font-extrabold px-3 py-1 rounded-lg text-xs uppercase tracking-wide">
            {status}
          </span>
        );
    }
  };

  return (
    <div className="space-y-6 pb-12 max-w-5xl mx-auto">
      {/* Header Summary & Refresh */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-white border border-slate-200 p-5 rounded-2xl shadow-xs">
        <div>
          <h1 className="text-2xl font-black text-slate-900 tracking-tight">Active Kitchen Queue</h1>
          <p className="text-xs text-slate-500 font-medium mt-0.5">
            Orders requiring worker action: Placed $\rightarrow$ Ready $\rightarrow$ Verify OTP Pickup
          </p>
        </div>

        <div className="flex items-center gap-3 shrink-0">
          <div
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-medium border ${
              realtimeStatus === 'connected'
                ? 'bg-emerald-50 border-emerald-200 text-emerald-700'
                : 'bg-amber-50 border-amber-200 text-amber-700'
            }`}
          >
            <Radio
              className={`w-3.5 h-3.5 ${
                realtimeStatus === 'connected' ? 'text-emerald-500 animate-pulse' : 'text-amber-500'
              }`}
            />
            <span>{realtimeStatus === 'connected' ? 'Live connected' : 'Reconnecting...'}</span>
          </div>

          <button
            onClick={() => loadOrders(true)}
            title="Refresh Queue"
            className="p-2.5 rounded-xl bg-white border border-slate-200 text-slate-700 hover:bg-slate-50 transition-colors shrink-0 shadow-xs flex items-center gap-1.5 text-xs font-bold"
          >
            <RefreshCw className={`w-4 h-4 text-slate-600 ${loading ? 'animate-spin' : ''}`} />
            <span>Refresh Queue</span>
          </button>
        </div>
      </div>

      {/* Worker Pickup Location Filter Bar */}
      <div className="bg-white border border-slate-200 p-4 rounded-2xl flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-xs">
        <div className="flex items-center gap-2">
          <MapPin className="w-5 h-5 text-slate-700 shrink-0" />
          <div>
            <h2 className="text-xs font-black uppercase tracking-wider text-slate-900">Pickup Location Queue</h2>
            <p className="text-[11px] text-slate-500 font-medium">Filter active worker order queue by campus canteen location</p>
          </div>
        </div>

        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 sm:pb-0 no-scrollbar">
          <button
            onClick={() => handleLocationFilterChange('all')}
            className={`px-3.5 py-2 rounded-xl text-xs font-extrabold whitespace-nowrap transition-all flex items-center gap-2 ${
              selectedLocationId === 'all'
                ? 'bg-slate-900 text-white shadow-xs'
                : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
            }`}
          >
            <span>All Locations</span>
            <span
              className={`px-2 py-0.5 rounded-full text-[10px] font-black ${
                selectedLocationId === 'all' ? 'bg-slate-800 text-white' : 'bg-slate-200 text-slate-800'
              }`}
            >
              {orders.length}
            </span>
          </button>

          {locations.map((loc) => {
            const locCount = orders.filter((o) => o.pickupLocationId === loc.id).length;
            const isLocSelected = selectedLocationId === loc.id;
            return (
              <button
                key={loc.id}
                onClick={() => handleLocationFilterChange(loc.id)}
                className={`px-3.5 py-2 rounded-xl text-xs font-extrabold whitespace-nowrap transition-all flex items-center gap-2 ${
                  isLocSelected
                    ? 'bg-blue-600 text-white shadow-xs'
                    : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                }`}
              >
                <span>{loc.name}</span>
                <span
                  className={`px-2 py-0.5 rounded-full text-[10px] font-black ${
                    isLocSelected ? 'bg-blue-700 text-white' : 'bg-slate-200 text-slate-800'
                  }`}
                >
                  {locCount}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Operational Summary Bar */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="bg-amber-50 border border-amber-200 p-3.5 rounded-2xl text-center">
          <span className="text-[10px] font-bold text-amber-800 uppercase tracking-wider block">
            Placed Queue
          </span>
          <span className="text-xl font-black text-amber-950 block">
            {getStatusCount('placed')}
          </span>
          <span className="text-[10px] text-amber-700 font-medium block">Awaiting prep</span>
        </div>

        <div className="bg-blue-50 border border-blue-200 p-3.5 rounded-2xl text-center">
          <span className="text-[10px] font-bold text-blue-800 uppercase tracking-wider block">
            Ready for Pickup
          </span>
          <span className="text-xl font-black text-blue-950 block">
            {getStatusCount('ready')}
          </span>
          <span className="text-[10px] text-blue-700 font-medium block">Awaiting OTP</span>
        </div>

        <div className="bg-slate-900 text-white p-3.5 rounded-2xl text-center border border-slate-800">
          <span className="text-[10px] font-bold text-amber-400 uppercase tracking-wider block">
            Total Active
          </span>
          <span className="text-xl font-black text-white block">
            {getStatusCount('all')}
          </span>
          <span className="text-[10px] text-slate-400 font-medium block">In kitchen system</span>
        </div>

        <div className="bg-slate-50 border border-slate-200 p-3.5 rounded-2xl text-center">
          <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block">
            Est. Avg Prep
          </span>
          <span className="text-xl font-black text-slate-900 block">
            ~10–12 min
          </span>
          <span className="text-[10px] text-slate-500 font-medium block">Target turnaround</span>
        </div>
      </div>

      {/* Success Alert Banner */}
      {successMessage && (
        <div className="bg-emerald-50 border border-emerald-200 text-emerald-900 text-xs font-semibold p-4 rounded-2xl flex items-center justify-between gap-3 shadow-xs animate-fadeIn">
          <div className="flex items-center gap-2">
            <CheckCheck className="w-5 h-5 text-emerald-600 shrink-0" />
            <span>{successMessage}</span>
          </div>
          <button
            onClick={() => setSuccessMessage(null)}
            className="text-emerald-700 font-bold hover:text-emerald-950 text-xs cursor-pointer"
          >
            Dismiss
          </button>
        </div>
      )}

      {/* Error Alert Banner */}
      {errorMessage && (
        <div className="bg-rose-50 border border-rose-200 text-rose-800 text-xs font-semibold p-4 rounded-2xl flex items-start gap-3 shadow-xs">
          <AlertCircle className="w-5 h-5 text-rose-600 shrink-0 mt-0.5" />
          <div className="space-y-0.5">
            <span className="font-bold block text-rose-900">Queue Processing Alert</span>
            <span>{errorMessage}</span>
          </div>
        </div>
      )}

      {/* Filter Tabs for Active Orders (Placed -> Ready) */}
      <div className="flex items-center gap-2 overflow-x-auto pb-1 no-scrollbar">
        {[
          { id: 'all', label: 'All Active Orders' },
          { id: 'placed', label: 'Placed' },
          { id: 'ready', label: 'Ready for Pickup' },
        ].map((tab) => {
          const count = getStatusCount(tab.id);
          const isActive = filterStatus === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => handleFilterChange(tab.id)}
              className={`px-4 py-2.5 rounded-xl text-xs font-bold whitespace-nowrap transition-all flex items-center gap-2 ${
                isActive
                  ? 'bg-slate-900 text-white shadow-md'
                  : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-100'
              }`}
            >
              <span>{tab.label}</span>
              <span
                className={`px-2 py-0.5 rounded-full text-[11px] font-black ${
                  isActive ? 'bg-slate-800 text-white' : 'bg-slate-100 text-slate-700'
                }`}
              >
                {count}
              </span>
            </button>
          );
        })}
      </div>

      {/* Pagination Status Range Bar */}
      {totalOrdersCount > 0 && (
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-slate-900 text-white p-3.5 px-5 rounded-2xl shadow-xs">
          <div className="text-xs font-semibold flex items-center gap-2">
            <span className="text-slate-400">Order Range:</span>
            <span className="font-bold text-amber-400">
              Showing orders {startIndex + 1}–{endIndex} of {totalOrdersCount}
            </span>
          </div>

          {/* Range Pages Selector & Previous/Next Buttons */}
          <div className="flex items-center gap-2">
            {/* Numbered Page Range Tabs */}
            {totalPages > 1 && (
              <div className="flex items-center gap-1 overflow-x-auto max-w-[280px] sm:max-w-[400px] no-scrollbar">
                {Array.from({ length: totalPages }, (_, i) => i + 1).map((p) => {
                  const pStart = (p - 1) * PAGE_SIZE + 1;
                  const pEnd = Math.min(p * PAGE_SIZE, totalOrdersCount);
                  const isPageActive = currentPage === p;
                  return (
                    <button
                      key={p}
                      onClick={() => setCurrentPage(p)}
                      className={`px-2.5 py-1 rounded-lg text-[11px] font-extrabold whitespace-nowrap transition-colors ${
                        isPageActive
                          ? 'bg-amber-500 text-slate-950 shadow-xs'
                          : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
                      }`}
                    >
                      {pStart}–{pEnd}
                    </button>
                  );
                })}
              </div>
            )}

            {/* Prev / Next Pagination Controls */}
            <div className="flex items-center gap-1.5 ml-2 border-l border-slate-700 pl-3">
              <button
                onClick={() => setCurrentPage((prev) => Math.max(1, prev - 1))}
                disabled={currentPage === 1}
                className="p-1.5 rounded-lg bg-slate-800 border border-slate-700 text-slate-200 hover:bg-slate-700 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                title="Previous 10 Orders"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
              <span className="text-xs font-bold px-1 text-slate-300">
                {currentPage} / {totalPages}
              </span>
              <button
                onClick={() => setCurrentPage((prev) => Math.min(totalPages, prev + 1))}
                disabled={currentPage >= totalPages}
                className="p-1.5 rounded-lg bg-slate-800 border border-slate-700 text-slate-200 hover:bg-slate-700 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                title="Next 10 Orders"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Loading State */}
      {loading ? (
        <div className="bg-white border border-slate-200/90 rounded-2xl p-12 flex flex-col items-center justify-center space-y-2 shadow-xs">
          <Loader2 className="w-6 h-6 text-slate-900 animate-spin" />
          <p className="text-xs font-semibold text-slate-500">Fetching kitchen orders queue...</p>
        </div>
      ) : currentOrdersPage.length === 0 ? (
        <EmptyState
          icon={<ChefHat className="w-10 h-10 text-slate-400" />}
          title="No orders in this queue tab"
          description="Incoming student orders will appear here as soon as they are placed."
        />
      ) : (
        /* Orders Grid / Cards List */
        <div className="space-y-4">
          {currentOrdersPage.map((order) => {
            const formattedDate = new Date(order.createdAt).toLocaleTimeString('en-US', {
              hour: 'numeric',
              minute: '2-digit',
              hour12: true,
            });

            const formattedFullDate = new Date(order.createdAt).toLocaleDateString('en-US', {
              month: 'short',
              day: 'numeric',
            });

            const isUpdating = updatingOrderId === order.id;
            const statusLower = order.status.toLowerCase();

            return (
              <Card
                key={order.id}
                padding="md"
                className="bg-white border-2 border-slate-200 hover:border-slate-300 transition-all space-y-4 shadow-sm rounded-2xl"
              >
                {/* Rush-Hour Header: Large Visible Order Number */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-3 border-b border-slate-200">
                  <div className="space-y-1">
                    <div className="flex items-center gap-3">
                      <span className="text-2xl sm:text-3xl font-black text-slate-900 tracking-tight">
                        ORDER #{order.orderNumber}
                      </span>
                      {getStatusBadge(order.status)}
                    </div>
                    <div className="flex items-center gap-2 text-xs text-slate-600 font-semibold">
                      <span className="flex items-center gap-1 text-slate-800">
                        <Clock className="w-4 h-4 text-slate-500" /> Placed at {formattedDate} ({formattedFullDate})
                      </span>
                      <span>•</span>
                      <span className="flex items-center gap-1 text-slate-800">
                        <Store className="w-4 h-4 text-slate-500" /> {order.pickupMethod}
                      </span>
                    </div>
                  </div>

                  <div className="text-left sm:text-right bg-slate-50 border border-slate-200 p-2 px-3 rounded-xl">
                    <span className="text-[10px] text-slate-500 font-bold block uppercase tracking-wider">
                      Total Amount
                    </span>
                    <span className="text-xl font-black text-emerald-700">₹{order.totalAmount}</span>
                  </div>
                </div>

                {/* Line Items List with Explicit Quantities */}
                <div className="space-y-2">
                  <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block">
                    Ordered Dishes & Quantities
                  </span>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5">
                    {order.items && order.items.length > 0 ? (
                      order.items.map((item) => (
                        <div
                          key={item.id}
                          className="flex items-center gap-3 bg-slate-50 border border-slate-200 p-2.5 rounded-xl text-xs"
                        >
                          <img
                            src={item.imageUrl || DEFAULT_FOOD_IMAGE}
                            alt={item.itemName}
                            className="w-12 h-12 object-cover rounded-lg border border-slate-200 bg-white shrink-0 shadow-xs"
                            onError={(e) => {
                              (e.target as HTMLImageElement).src = DEFAULT_FOOD_IMAGE;
                            }}
                          />
                          <div className="min-w-0 flex-1">
                            <div className="flex items-center gap-1.5">
                              <span className="text-xs font-black text-amber-900 bg-amber-100 border border-amber-200 px-1.5 py-0.5 rounded-md shrink-0">
                                {item.quantity} ×
                              </span>
                              <span className="font-extrabold text-slate-900 text-sm truncate">
                                {item.itemName}
                              </span>
                            </div>
                            <span className="text-slate-500 text-[11px] font-medium block mt-0.5">
                              Unit: ₹{item.unitPrice}
                            </span>
                          </div>
                          <span className="font-extrabold text-slate-900 shrink-0 text-sm">
                            ₹{item.lineTotal}
                          </span>
                        </div>
                      ))
                    ) : (
                      <span className="text-xs text-slate-400 italic">No line item details available</span>
                    )}
                  </div>
                </div>

                {/* Status Transition Action Buttons */}
                <div className="pt-3 border-t border-slate-100 flex items-center justify-between gap-3">
                  <div className="text-xs text-slate-500 font-medium">
                    {statusLower === 'placed' && 'Order received. Prepare food and mark ready when prepared.'}
                    {statusLower === 'ready' && 'Food ready at counter. Awaiting student OTP verification.'}
                    {statusLower === 'delivered' && 'Food handed to student. Order fulfilled.'}
                    {statusLower === 'cancelled' && 'Order cancelled by student.'}
                  </div>

                  <div className="flex items-center gap-2">
                    {statusLower === 'placed' && (
                      <Button
                        variant="primary"
                        size="md"
                        onClick={() => handleStatusTransition(order.id, 'ready')}
                        disabled={isUpdating}
                        leftIcon={
                          isUpdating ? (
                            <Loader2 className="w-4 h-4 animate-spin" />
                          ) : (
                            <CheckCircle className="w-4 h-4 text-white" />
                          )
                        }
                        className="bg-blue-600 hover:bg-blue-700 text-white font-extrabold px-5 py-2.5 rounded-xl shadow-xs"
                      >
                        {isUpdating ? 'Updating...' : 'MARK READY'}
                      </Button>
                    )}

                    {statusLower === 'ready' && (
                      <Button
                        variant="primary"
                        size="md"
                        onClick={() => handleOpenVerifyModal(order)}
                        leftIcon={<KeyRound className="w-4 h-4 text-white" />}
                        className="bg-emerald-600 hover:bg-emerald-700 text-white font-extrabold px-5 py-2.5 rounded-xl shadow-xs"
                      >
                        VERIFY PICKUP
                      </Button>
                    )}

                    {statusLower === 'delivered' && (
                      <span className="inline-flex items-center gap-1.5 text-xs font-bold text-emerald-800 bg-emerald-50 px-3.5 py-2 rounded-xl border border-emerald-200">
                        <CheckCheck className="w-4 h-4 text-emerald-600" /> Order Delivered
                      </span>
                    )}

                    {statusLower === 'cancelled' && (
                      <span className="inline-flex items-center gap-1.5 text-xs font-bold text-rose-700 bg-rose-50 px-3.5 py-2 rounded-xl border border-rose-200">
                        Cancelled by Student
                      </span>
                    )}
                  </div>
                </div>
              </Card>
            );
          })}
        </div>
      )}

      {/* Bottom Pagination Controls for Long Pages */}
      {totalOrdersCount > PAGE_SIZE && (
        <div className="flex items-center justify-between bg-white border border-slate-200 p-4 rounded-2xl shadow-xs">
          <span className="text-xs font-bold text-slate-600">
            Showing orders {startIndex + 1}–{endIndex} of {totalOrdersCount}
          </span>

          <div className="flex items-center gap-2">
            <button
              onClick={() => setCurrentPage((prev) => Math.max(1, prev - 1))}
              disabled={currentPage === 1}
              className="px-3 py-1.5 rounded-xl bg-white border border-slate-200 text-slate-700 font-bold text-xs hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed transition-colors shadow-xs flex items-center gap-1"
            >
              <ChevronLeft className="w-4 h-4" />
              <span>Previous</span>
            </button>
            <span className="text-xs font-black text-slate-800 px-2">
              Page {currentPage} of {totalPages}
            </span>
            <button
              onClick={() => setCurrentPage((prev) => Math.min(totalPages, prev + 1))}
              disabled={currentPage >= totalPages}
              className="px-3 py-1.5 rounded-xl bg-white border border-slate-200 text-slate-700 font-bold text-xs hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed transition-colors shadow-xs flex items-center gap-1"
            >
              <span>Next</span>
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}
      {/* Verify Pickup OTP Modal Dialog */}
      {verifyModalOrder && (
        <div className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-xs flex items-center justify-center p-4 animate-fadeIn">
          <div className="bg-white border border-slate-200 rounded-3xl p-6 max-w-sm w-full space-y-4 shadow-xl">
            <div className="w-12 h-12 rounded-full bg-amber-100 text-amber-800 flex items-center justify-center mx-auto">
              <KeyRound className="w-6 h-6" />
            </div>

            <div className="text-center space-y-1">
              <h3 className="text-xl font-black text-slate-900">
                Order #{verifyModalOrder.orderNumber}
              </h3>
              <p className="text-xs text-slate-500 leading-relaxed font-medium">
                Enter the 4-digit pickup OTP provided by the student.
              </p>
            </div>

            <form onSubmit={handleVerifySubmit} className="space-y-4">
              <div className="space-y-1">
                <label className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block text-center">
                  Pickup OTP
                </label>
                <input
                  type="text"
                  inputMode="numeric"
                  pattern="[0-9]*"
                  maxLength={4}
                  autoFocus
                  value={otpInput}
                  onChange={handleOtpInputChange}
                  placeholder="0000"
                  disabled={isVerifyingOtp}
                  className="w-full text-center text-3xl font-black font-mono tracking-widest px-4 py-3 bg-slate-50 border-2 border-slate-300 rounded-2xl focus:border-amber-500 focus:bg-white focus:outline-none transition-all placeholder:text-slate-300 text-slate-900"
                />
              </div>

              {otpError && (
                <div className="bg-rose-50 border border-rose-200 text-rose-800 text-xs font-semibold p-3 rounded-xl text-center animate-fadeIn">
                  {otpError}
                </div>
              )}

              <div className="flex items-center gap-2 pt-2">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={handleCloseVerifyModal}
                  disabled={isVerifyingOtp}
                  className="flex-1 py-2.5"
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  variant="primary"
                  size="sm"
                  disabled={isVerifyingOtp || otpInput.length !== 4}
                  leftIcon={isVerifyingOtp ? <Loader2 className="w-4 h-4 animate-spin" /> : undefined}
                  className="flex-1 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white border-none font-bold"
                >
                  {isVerifyingOtp ? 'Verifying...' : 'Verify Pickup'}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

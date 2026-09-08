import React, { useState, useEffect, useCallback } from 'react';
import { Order, HistoryFilterState, PickupLocation } from '../types';
import {
  fetchWorkerOrderHistory,
  exportWorkerOrderHistoryCsv,
  getMonthWeekRanges,
  getFilterHeadingTitle,
  fetchActivePickupLocations,
} from '../services/orderService';
import { Card } from '../shared/components/Card';
import { Button } from '../shared/components/Button';
import { EmptyState } from '../shared/components/EmptyState';
import { CalendarPicker } from '../shared/components/CalendarPicker';
import {
  FileText,
  Search,
  Download,
  Clock,
  CheckCheck,
  Store,
  ChevronLeft,
  ChevronRight,
  Loader2,
  AlertCircle,
  Info,
  Calendar,
  RefreshCw,
  MapPin,
} from 'lucide-react';
import { DEFAULT_FOOD_IMAGE } from '../services/menuService';

const PAGE_SIZE = 10;
const MONTH_NAMES_SHORT = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

export const WorkerOrderHistory: React.FC = () => {
  const [orders, setOrders] = useState<Order[]>([]);
  const [totalCount, setTotalCount] = useState<number>(0);
  const [loading, setLoading] = useState<boolean>(true);
  const [locations, setLocations] = useState<PickupLocation[]>([]);
  const [selectedLocationId, setSelectedLocationId] = useState<string>('all');

  // Initial Filter State
  const now = new Date();
  const [filterState, setFilterState] = useState<HistoryFilterState>({
    mode: 'today',
    selectedYear: now.getFullYear(),
    selectedMonth: now.getMonth(),
  });

  // Calendar Modal state
  const [showCalendar, setShowCalendar] = useState<boolean>(false);

  // Search & Pagination State
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [debouncedSearch, setDebouncedSearch] = useState<string>('');
  const [currentPage, setCurrentPage] = useState<number>(1);

  // Feedback Banners State
  const [isExporting, setIsExporting] = useState<boolean>(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  // Load active pickup locations dynamically
  const loadLocations = useCallback(async () => {
    try {
      const locs = await fetchActivePickupLocations();
      setLocations(locs);
    } catch (err) {
      console.warn('[WorkerOrderHistory] Error loading pickup locations:', err);
    }
  }, []);

  useEffect(() => {
    loadLocations();
  }, [loadLocations]);

  // Handle Search Input Debounce (300ms)
  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedSearch(searchQuery);
    }, 300);
    return () => clearTimeout(handler);
  }, [searchQuery]);

  // Load delivered order history from database
  const loadHistory = useCallback(async () => {
    setLoading(true);
    setErrorMessage(null);
    try {
      const result = await fetchWorkerOrderHistory({
        filterState,
        searchQuery: debouncedSearch,
        pickupLocationId: selectedLocationId,
        page: currentPage,
        pageSize: PAGE_SIZE,
      });

      setOrders(result.orders);
      setTotalCount(result.totalCount);
    } catch (err) {
      console.error('[WorkerOrderHistory] Error loading order history:', err);
      setErrorMessage('Failed to load delivered order history from server.');
    } finally {
      setLoading(false);
    }
  }, [filterState, debouncedSearch, selectedLocationId, currentPage]);

  useEffect(() => {
    loadHistory();
  }, [loadHistory]);

  // Filter Mode Triggers
  const handleQuickFilter = (mode: 'today' | 'yesterday' | 'all') => {
    setFilterState((prev) => ({
      ...prev,
      mode,
      selectedDate: undefined,
      selectedWeekIndex: undefined,
    }));
    setCurrentPage(1);
  };

  const handleLocationSelect = (locId: string) => {
    setSelectedLocationId(locId);
    setCurrentPage(1);
  };

  const handleMonthSelect = (monthIndex: number) => {
    setFilterState((prev) => ({
      ...prev,
      mode: 'month',
      selectedMonth: monthIndex,
      selectedWeekIndex: undefined,
      selectedDate: undefined,
    }));
    setCurrentPage(1);
  };

  const handleWeekSelect = (weekIndex: number) => {
    setFilterState((prev) => ({
      ...prev,
      mode: 'week',
      selectedWeekIndex: weekIndex,
      selectedDate: undefined,
    }));
    setCurrentPage(1);
  };

  const handleYearChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const newYear = Number(e.target.value);
    setFilterState((prev) => ({
      ...prev,
      selectedYear: newYear,
      selectedWeekIndex: undefined,
      selectedDate: undefined,
    }));
    setCurrentPage(1);
  };

  const handleDateSelectFromCalendar = (dateStr: string) => {
    const parts = dateStr.split('-').map(Number);
    if (parts.length === 3) {
      const [y, m] = parts;
      setFilterState({
        mode: 'date',
        selectedYear: y,
        selectedMonth: m - 1,
        selectedDate: dateStr,
      });
      setCurrentPage(1);
    }
  };

  const handleSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setSearchQuery(e.target.value);
    setCurrentPage(1);
  };

  // CSV Export Handler
  const handleExportCsv = async () => {
    if (isExporting) return;
    setIsExporting(true);
    setErrorMessage(null);
    setSuccessMessage(null);

    const result = await exportWorkerOrderHistoryCsv({
      filterState,
      searchQuery: debouncedSearch,
      pickupLocationId: selectedLocationId,
    });

    setIsExporting(false);

    if (result.success && result.filename) {
      setSuccessMessage(`Order history saved to device downloads as "${result.filename}".`);
    } else {
      setErrorMessage(result.error || 'Unable to generate CSV export file.');
    }
  };

  // Dynamic Week Ranges for active month & year
  const weekRanges = getMonthWeekRanges(filterState.selectedYear, filterState.selectedMonth);

  // Pagination bounds calculation
  const totalPages = Math.max(1, Math.ceil(totalCount / PAGE_SIZE));
  const startIndex = totalCount === 0 ? 0 : (currentPage - 1) * PAGE_SIZE + 1;
  const endIndex = Math.min(currentPage * PAGE_SIZE, totalCount);

  // Dynamic Header Title
  const headingTitle = getFilterHeadingTitle(filterState);

  // Helper text for empty states
  const getEmptyStateDescription = () => {
    if (debouncedSearch) {
      return `No delivered orders matched order number search "${debouncedSearch}".`;
    }
    const { mode, selectedYear, selectedMonth, selectedDate, selectedWeekIndex } = filterState;

    if (mode === 'date' && selectedDate) {
      const parts = selectedDate.split('-').map(Number);
      const dateStr = parts.length === 3 ? new Date(parts[0], parts[1] - 1, parts[2]).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : selectedDate;
      return `No delivered orders on ${dateStr}.`;
    }

    if (mode === 'month') {
      const monthName = new Date(selectedYear, selectedMonth, 1).toLocaleString('en-US', { month: 'long' });
      return `No orders were delivered in ${monthName} ${selectedYear}.`;
    }

    if (mode === 'week') {
      const label = weekRanges[selectedWeekIndex || 0]?.label || `Week ${(selectedWeekIndex || 0) + 1}`;
      return `No orders were delivered during ${label}.`;
    }

    if (mode === 'today') {
      return 'No orders were delivered today.';
    }

    if (mode === 'yesterday') {
      return 'No orders were delivered yesterday.';
    }

    return 'No delivered order history records found in database.';
  };

  // Generate Year Options for Dropdown (current year +- 5 years)
  const yearOptions = Array.from({ length: 11 }, (_, i) => now.getFullYear() - 5 + i);

  return (
    <div className="space-y-6 pb-12 max-w-5xl mx-auto">
      {/* Header Summary & CSV Export */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white border border-slate-200 p-5 rounded-2xl shadow-xs">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <FileText className="w-6 h-6 text-slate-900" />
            <h1 className="text-2xl font-black text-slate-900 tracking-tight">Order History</h1>
          </div>
          <p className="text-xs text-slate-500 font-medium">
            Permanent record of completed & delivered student orders.
          </p>
        </div>

        <div className="flex items-center gap-2.5">
          <button
            onClick={loadHistory}
            disabled={loading}
            title="Refresh History"
            className="p-2.5 rounded-xl bg-white border border-slate-200 text-slate-700 hover:bg-slate-50 disabled:opacity-50 transition-colors shrink-0 shadow-xs flex items-center gap-1.5 text-xs font-bold"
          >
            <RefreshCw className={`w-4 h-4 text-slate-600 ${loading ? 'animate-spin' : ''}`} />
            <span className="hidden sm:inline">Refresh</span>
          </button>

          <Button
            variant="primary"
            size="md"
            onClick={handleExportCsv}
            disabled={isExporting || totalCount === 0}
            leftIcon={
              isExporting ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Download className="w-4 h-4 text-white" />
              )
            }
            className="bg-emerald-600 hover:bg-emerald-700 text-white font-extrabold px-4 py-2.5 rounded-xl shadow-xs shrink-0"
          >
            {isExporting ? 'Exporting...' : 'Save to Device'}
          </Button>
        </div>
      </div>

      {/* Save to Device File Copy Explanation Note */}
      <div className="bg-amber-50/80 border border-amber-200 text-amber-900 text-xs p-3.5 px-4 rounded-xl flex items-start gap-2.5 shadow-2xs">
        <Info className="w-4 h-4 text-amber-700 shrink-0 mt-0.5" />
        <p className="leading-relaxed font-medium">
          <strong className="font-bold">Device Copy Disclaimer:</strong> Saved CSV files are local copies on this device. Deleting a saved file does not delete the official order history in Supabase.
        </p>
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
            <span className="font-bold block text-rose-900">Order History Error</span>
            <span>{errorMessage}</span>
          </div>
        </div>
      )}

      {/* Redesigned Structured Filter Panel */}
      <div className="bg-white border border-slate-200 p-4 sm:p-5 rounded-2xl space-y-4 shadow-xs">
        {/* Row 1: Search + Quick Filters + Calendar Date Button */}
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3">
          {/* Quick Filters & Calendar */}
          <div className="flex items-center gap-2 overflow-x-auto pb-1 lg:pb-0 no-scrollbar">
            <button
              onClick={() => handleQuickFilter('today')}
              className={`px-3.5 py-2 rounded-xl text-xs font-bold whitespace-nowrap transition-all ${
                filterState.mode === 'today'
                  ? 'bg-slate-900 text-white shadow-xs'
                  : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
              }`}
            >
              Today
            </button>

            <button
              onClick={() => handleQuickFilter('yesterday')}
              className={`px-3.5 py-2 rounded-xl text-xs font-bold whitespace-nowrap transition-all ${
                filterState.mode === 'yesterday'
                  ? 'bg-slate-900 text-white shadow-xs'
                  : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
              }`}
            >
              Yesterday
            </button>

            {/* Calendar Date Picker Button */}
            <button
              onClick={() => setShowCalendar(true)}
              className={`px-3.5 py-2 rounded-xl text-xs font-bold whitespace-nowrap transition-all flex items-center gap-1.5 ${
                filterState.mode === 'date'
                  ? 'bg-amber-500 text-slate-950 font-black shadow-xs ring-2 ring-amber-300'
                  : 'bg-slate-100 text-slate-800 hover:bg-slate-200 border border-slate-300'
              }`}
            >
              <Calendar className="w-3.5 h-3.5 text-amber-700" />
              <span>
                {filterState.mode === 'date' && filterState.selectedDate
                  ? filterState.selectedDate
                  : 'Select Date'}
              </span>
            </button>

            <button
              onClick={() => handleQuickFilter('all')}
              className={`px-3.5 py-2 rounded-xl text-xs font-bold whitespace-nowrap transition-all ${
                filterState.mode === 'all'
                  ? 'bg-slate-900 text-white shadow-xs'
                  : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
              }`}
            >
              All History
            </button>
          </div>

          {/* Search Order Number Input */}
          <div className="relative w-full lg:w-64">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchQuery}
              onChange={handleSearchChange}
              placeholder="Search order number..."
              className="w-full text-xs font-semibold pl-9 pr-8 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:border-slate-800 focus:bg-white focus:outline-none transition-all placeholder:text-slate-400 text-slate-900"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery('')}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-xs font-extrabold text-slate-400 hover:text-slate-700 p-0.5"
              >
                ✕
              </button>
            )}
          </div>
        </div>

        {/* Row 1.5: Pickup Location Filter */}
        <div className="pt-3 border-t border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block flex items-center gap-1">
            <MapPin className="w-3.5 h-3.5 text-slate-500" />
            Filter by Pickup Location
          </span>

          <div className="flex items-center gap-1.5 overflow-x-auto pb-1 sm:pb-0 no-scrollbar">
            <button
              onClick={() => handleLocationSelect('all')}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold whitespace-nowrap transition-all ${
                selectedLocationId === 'all'
                  ? 'bg-slate-900 text-white shadow-xs'
                  : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
              }`}
            >
              All Locations
            </button>

            {locations.map((loc) => {
              const isLocActive = selectedLocationId === loc.id;
              return (
                <button
                  key={loc.id}
                  onClick={() => handleLocationSelect(loc.id)}
                  className={`px-3 py-1.5 rounded-xl text-xs font-bold whitespace-nowrap transition-all ${
                    isLocActive
                      ? 'bg-blue-600 text-white shadow-xs'
                      : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                  }`}
                >
                  {loc.name}
                </button>
              );
            })}
          </div>
        </div>

        {/* Row 2: Year Selector + 12 Real Months (Jan - Dec) */}
        <div className="pt-3 border-t border-slate-100 space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block">
              Filter by Month ({filterState.selectedYear})
            </span>

            {/* Selectable Year */}
            <div className="flex items-center gap-1 text-xs">
              <span className="text-slate-500 font-bold text-[11px]">Year:</span>
              <select
                value={filterState.selectedYear}
                onChange={handleYearChange}
                className="text-xs font-extrabold bg-slate-100 border border-slate-200 rounded-lg px-2.5 py-1 text-slate-900 focus:outline-none focus:border-slate-800 cursor-pointer"
              >
                {yearOptions.map((y) => (
                  <option key={y} value={y}>
                    {y}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Month Shortcuts Bar (Jan-Dec) */}
          <div className="grid grid-cols-4 sm:grid-cols-6 md:grid-cols-12 gap-1.5">
            {MONTH_NAMES_SHORT.map((mName, mIdx) => {
              const isMonthActive =
                (filterState.mode === 'month' || filterState.mode === 'week') &&
                filterState.selectedMonth === mIdx;

              return (
                <button
                  key={mName}
                  onClick={() => handleMonthSelect(mIdx)}
                  className={`py-1.5 px-2 rounded-xl text-xs font-black transition-all text-center ${
                    isMonthActive
                      ? 'bg-slate-900 text-white shadow-xs scale-105'
                      : 'bg-slate-50 text-slate-700 border border-slate-200 hover:bg-slate-100 hover:text-slate-950'
                  }`}
                >
                  {mName}
                </button>
              );
            })}
          </div>
        </div>

        {/* Row 3: Dynamic Week Shortcuts (Week 1 to Week 5 for selected month) */}
        <div className="pt-3 border-t border-slate-100 space-y-2">
          <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block">
            Weeks in {MONTH_NAMES_SHORT[filterState.selectedMonth]} {filterState.selectedYear}
          </span>

          <div className="flex items-center gap-2 overflow-x-auto pb-1 no-scrollbar">
            {weekRanges.map((wRange) => {
              const isWeekActive =
                filterState.mode === 'week' && filterState.selectedWeekIndex === wRange.weekIndex;

              return (
                <button
                  key={wRange.weekIndex}
                  onClick={() => handleWeekSelect(wRange.weekIndex)}
                  className={`px-3 py-1.5 rounded-xl text-xs font-extrabold whitespace-nowrap transition-all flex items-center gap-1.5 ${
                    isWeekActive
                      ? 'bg-amber-500 text-slate-950 shadow-xs ring-2 ring-amber-300'
                      : 'bg-slate-50 text-slate-700 border border-slate-200 hover:bg-slate-100'
                  }`}
                >
                  <span>{wRange.label}</span>
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {/* Main Title Heading Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 bg-slate-900 text-white p-4 px-5 rounded-2xl shadow-xs">
        <div className="space-y-0.5">
          <h2 className="text-base sm:text-lg font-black tracking-tight text-white">{headingTitle}</h2>
          <p className="text-xs text-slate-400 font-medium">
            Delivered orders matching active filters
          </p>
        </div>

        {totalCount > 0 && (
          <span className="bg-slate-800 text-amber-400 border border-slate-700 font-black text-xs px-3.5 py-1.5 rounded-xl shrink-0">
            Showing {startIndex}–{endIndex} of {totalCount} orders
          </span>
        )}
      </div>

      {/* Loading State */}
      {loading ? (
        <div className="bg-white border border-slate-200/90 rounded-2xl p-12 flex flex-col items-center justify-center space-y-2 shadow-xs">
          <Loader2 className="w-6 h-6 text-slate-900 animate-spin" />
          <p className="text-xs font-semibold text-slate-500">Fetching delivered order history...</p>
        </div>
      ) : orders.length === 0 ? (
        <EmptyState
          icon={<FileText className="w-10 h-10 text-slate-400" />}
          title="No delivered orders found"
          description={getEmptyStateDescription()}
        />
      ) : (
        /* History Orders List */
        <div className="space-y-4">
          {orders.map((order) => {
            const formattedDate = new Date(order.createdAt).toLocaleTimeString('en-US', {
              hour: 'numeric',
              minute: '2-digit',
              hour12: true,
            });

            const formattedFullDate = new Date(order.createdAt).toLocaleDateString('en-US', {
              month: 'short',
              day: 'numeric',
              year: 'numeric',
            });

            let deliveredTimeText = 'N/A';
            const delTimestamp = order.deliveredAt || order.pickupOtpVerifiedAt || order.updatedAt;
            if (delTimestamp) {
              const delDate = new Date(delTimestamp);
              deliveredTimeText = `${delDate.toLocaleDateString('en-US', {
                month: 'short',
                day: 'numeric',
              })} at ${delDate.toLocaleTimeString('en-US', {
                hour: 'numeric',
                minute: '2-digit',
                hour12: true,
              })}`;
            }

            return (
              <Card
                key={order.id}
                padding="md"
                className="bg-white border-2 border-slate-200 hover:border-slate-300 transition-all space-y-4 shadow-xs rounded-2xl"
              >
                {/* Header: Order Number & Status */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-3 border-b border-slate-200">
                  <div className="space-y-1">
                    <div className="flex items-center gap-3">
                      <span className="text-2xl sm:text-3xl font-black text-slate-900 tracking-tight">
                        ORDER #{order.orderNumber}
                      </span>
                      <span className="bg-emerald-100 text-emerald-800 border border-emerald-300 font-extrabold px-3 py-1 rounded-lg text-xs uppercase tracking-wide flex items-center gap-1">
                        <CheckCheck className="w-3.5 h-3.5 text-emerald-700" /> Delivered
                      </span>
                    </div>
                    <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-slate-600 font-semibold">
                      <span className="flex items-center gap-1 text-slate-800">
                        <Clock className="w-4 h-4 text-slate-500" /> Placed {formattedDate} ({formattedFullDate})
                      </span>
                      <span>•</span>
                      <span className="flex items-center gap-1 text-slate-800">
                        <Store className="w-4 h-4 text-slate-500" /> {order.pickupMethod}
                      </span>
                    </div>
                  </div>

                  <div className="text-left sm:text-right bg-slate-50 border border-slate-200 p-2 px-3.5 rounded-xl">
                    <span className="text-[10px] text-slate-500 font-bold block uppercase tracking-wider">
                      Total Amount
                    </span>
                    <span className="text-xl font-black text-emerald-700">₹{order.totalAmount}</span>
                  </div>
                </div>

                {/* Line Items List from Order Snapshots */}
                <div className="space-y-2">
                  <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block">
                    Delivered Items Snapshot
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
                            className="w-12 h-12 object-cover rounded-lg border border-slate-200 bg-white shrink-0 shadow-2xs"
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
                      <span className="text-xs text-slate-400 italic">No line item details stored</span>
                    )}
                  </div>
                </div>

                {/* Footer Delivery Details */}
                <div className="pt-3 border-t border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs text-slate-500 font-medium">
                  <div className="flex items-center gap-1.5">
                    <CheckCheck className="w-4 h-4 text-emerald-600 shrink-0" />
                    <span>
                      Delivered / Verified: <strong className="text-slate-800 font-bold">{deliveredTimeText}</strong>
                    </span>
                  </div>
                  <span className="text-[11px] text-slate-400">Order ID: {order.id}</span>
                </div>
              </Card>
            );
          })}
        </div>
      )}

      {/* Bottom Pagination Controls */}
      {totalCount > PAGE_SIZE && (
        <div className="flex items-center justify-between bg-white border border-slate-200 p-4 rounded-2xl shadow-xs">
          <span className="text-xs font-bold text-slate-600">
            Showing {startIndex}–{endIndex} of {totalCount} history records
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

      {/* Calendar Date Picker Dialog */}
      {showCalendar && (
        <CalendarPicker
          selectedDate={filterState.selectedDate}
          onSelectDate={handleDateSelectFromCalendar}
          onClose={() => setShowCalendar(false)}
        />
      )}
    </div>
  );
};

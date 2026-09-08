import { supabase } from './supabase';
import { CartItem } from '../contexts/CartContext';
import { Order, OrderItem, CreateOrderResult, HistoryDateFilter, HistoryFilterState, PickupLocation } from '../types';
import { fetchOrderEta, getConfidenceBadgeStyle } from './etaPredictionService';

export { fetchOrderEta, getConfidenceBadgeStyle };

/**
 * Fetch all currently active campus pickup locations (e.g. Canteen 1, Canteen 2).
 */
export async function fetchActivePickupLocations(): Promise<PickupLocation[]> {
  try {
    const { data, error } = await supabase
      .from('pickup_locations')
      .select('*')
      .eq('is_active', true)
      .order('name', { ascending: true });

    if (error) {
      console.warn('[orderService] Error fetching active pickup locations:', error);
      return [];
    }

    if (!data) return [];

    return data.map((row) => ({
      id: row.id,
      name: row.name,
      code: row.code,
      isActive: row.is_active,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    }));
  } catch (err) {
    console.error('[orderService] Exception during fetchActivePickupLocations:', err);
    return [];
  }
}

/**
 * Atomic order creation via secure Supabase stored procedure `create_student_order`.
 * Calculates prices and line totals directly from active database menu items.
 * Validates selected pickup location server-side.
 */
export async function placeStudentOrder(
  cartItems: CartItem[],
  pickupLocationId: string
): Promise<CreateOrderResult> {
  if (!cartItems || cartItems.length === 0) {
    return {
      success: false,
      error: 'Your cart is empty. Please add food items before placing an order.',
    };
  }

  if (!pickupLocationId || pickupLocationId.trim() === '') {
    return {
      success: false,
      error: 'Please select a pickup location.',
    };
  }

  try {
    const payload = cartItems.map((item) => ({
      menu_item_id: item.id,
      quantity: item.quantity,
    }));

    const { data, error } = await supabase.rpc('create_student_order', {
      p_cart_items: payload,
      p_pickup_location_id: pickupLocationId,
    });

    if (error) {
      console.warn('[orderService] Supabase RPC create_student_order error:', error);

      if (error.code === 'PGRST202' || error.code === '42883' || error.message.includes('Could not find')) {
        return {
          success: false,
          error:
            'Order system migration (013_pickup_locations.sql) has not been run in Supabase. Please execute database/migrations/013_pickup_locations.sql in your Supabase SQL Editor.',
        };
      }

      return {
        success: false,
        error: error.message || 'We could not place your order. Please try again.',
      };
    }

    if (!data || !data.success) {
      return {
        success: false,
        error: (data && data.error) || 'Failed to complete order insertion.',
      };
    }

    return {
      success: true,
      orderId: data.order_id,
      orderNumber: data.order_number,
      totalAmount: Number(data.total_amount),
      pickupOtp: data.pickup_otp || undefined,
      pickupLocationId: data.pickup_location_id || pickupLocationId,
      pickupLocationName: data.pickup_location_name || undefined,
    };
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Unknown network error placing order';
    console.error('[orderService] Exception during placeStudentOrder:', err);
    return {
      success: false,
      error: msg,
    };
  }
}

/**
 * Fetch all orders belonging to the currently authenticated student.
 */
export async function fetchStudentOrders(): Promise<Order[]> {
  try {
    const { data, error } = await supabase
      .from('orders')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) {
      console.warn('[orderService] Error fetching student orders:', error);
      return [];
    }

    if (!data) return [];

    return data.map((row) => ({
      id: row.id,
      orderNumber: row.order_number || 0,
      studentId: row.student_id,
      totalAmount: Number(row.total_amount || 0),
      status: row.status,
      pickupMethod: row.pickup_location_name || row.pickup_method || 'Canteen Pickup',
      pickupLocationId: row.pickup_location_id || undefined,
      pickupLocationName: row.pickup_location_name || row.pickup_method || undefined,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
      cancelledAt: row.cancelled_at || undefined,
      pickupOtp: row.pickup_otp || undefined,
      pickupOtpVerifiedAt: row.pickup_otp_verified_at || undefined,
      deliveredAt: row.delivered_at || undefined,
    }));
  } catch (err) {
    console.error('[orderService] Exception during fetchStudentOrders:', err);
    return [];
  }
}

/**
 * Fetch detailed order header & line items by order ID.
 * Uses snapshotted order_items data (independent of menu_items deletion).
 */
export async function fetchStudentOrderDetails(
  orderId: string
): Promise<{ order: Order; items: OrderItem[] } | null> {
  try {
    const [orderRes, itemsRes] = await Promise.all([
      supabase.from('orders').select('*').eq('id', orderId).maybeSingle(),
      supabase.from('order_items').select('*').eq('order_id', orderId),
    ]);

    if (orderRes.error || !orderRes.data) {
      console.warn('[orderService] Order fetch failed or not found:', orderRes.error);
      return null;
    }

    const orderData = orderRes.data;
    const itemsData = itemsRes.data || [];

    const order: Order = {
      id: orderData.id,
      orderNumber: orderData.order_number || 0,
      studentId: orderData.student_id,
      totalAmount: Number(orderData.total_amount || 0),
      status: orderData.status,
      pickupMethod: orderData.pickup_location_name || orderData.pickup_method || 'Canteen Pickup',
      pickupLocationId: orderData.pickup_location_id || undefined,
      pickupLocationName: orderData.pickup_location_name || orderData.pickup_method || undefined,
      createdAt: orderData.created_at,
      updatedAt: orderData.updated_at,
      cancelledAt: orderData.cancelled_at || undefined,
      pickupOtp: orderData.pickup_otp || undefined,
      pickupOtpVerifiedAt: orderData.pickup_otp_verified_at || undefined,
      deliveredAt: orderData.delivered_at || undefined,
    };

    const items: OrderItem[] = itemsData.map((item) => ({
      id: item.id,
      orderId: item.order_id,
      menuItemId: item.menu_item_id,
      itemName: item.item_name,
      unitPrice: Number(item.unit_price || 0),
      quantity: Number(item.quantity || 1),
      lineTotal: Number(item.line_total || 0),
      imageUrl: item.image_url,
      createdAt: item.created_at,
    }));

    return { order, items };
  } catch (err) {
    console.error('[orderService] Exception during fetchStudentOrderDetails:', err);
    return null;
  }
}

/**
 * Cancel an active student order using secure Supabase stored procedure `cancel_student_order`.
 * Order status must be strictly 'placed'.
 */
export async function cancelStudentOrder(
  orderId: string
): Promise<{ success: boolean; error?: string }> {
  if (!orderId) {
    return { success: false, error: 'Invalid order ID specified.' };
  }

  try {
    const { data, error } = await supabase.rpc('cancel_student_order', {
      p_order_id: orderId,
    });

    if (error) {
      console.warn('[orderService] Supabase RPC cancel_student_order error:', error);

      if (error.code === 'PGRST202' || error.code === '42883' || error.message.includes('Could not find')) {
        return {
          success: false,
          error:
            'Order cancellation migration (007_student_order_cancellation.sql) has not been run in Supabase. Please execute database/migrations/007_student_order_cancellation.sql in your Supabase SQL Editor.',
        };
      }

      return {
        success: false,
        error: error.message || 'Unable to cancel the order. Please try again.',
      };
    }

    if (!data || !data.success) {
      return {
        success: false,
        error: (data && data.error) || 'Failed to cancel the order.',
      };
    }

    return { success: true };
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Unknown network error cancelling order';
    console.error('[orderService] Exception during cancelStudentOrder:', err);
    return {
      success: false,
      error: msg,
    };
  }
}

/**
 * Fetch active canteen orders for the Kitchen Operations Queue (Worker view).
 * Returns orders needing worker action (placed, ready) along with their snapshotted line items.
 */
export async function fetchWorkerOrders(): Promise<Order[]> {
  try {
    const [ordersRes, itemsRes] = await Promise.all([
      supabase
        .from('orders')
        .select('id, order_number, student_id, total_amount, status, pickup_method, pickup_location_id, pickup_location_name, created_at, updated_at, cancelled_at, pickup_otp_verified_at')
        .in('status', ['placed', 'ready'])
        .order('created_at', { ascending: false }),
      supabase.from('order_items').select('*'),
    ]);

    if (ordersRes.error) {
      console.warn('[orderService] Error fetching worker orders:', ordersRes.error);
      return [];
    }

    const ordersData = ordersRes.data || [];
    const itemsData = itemsRes.data || [];

    return ordersData.map((row) => {
      const orderItems: OrderItem[] = itemsData
        .filter((item) => item.order_id === row.id)
        .map((item) => ({
          id: item.id,
          orderId: item.order_id,
          menuItemId: item.menu_item_id,
          itemName: item.item_name,
          unitPrice: Number(item.unit_price || 0),
          quantity: Number(item.quantity || 1),
          lineTotal: Number(item.line_total || 0),
          imageUrl: item.image_url,
          createdAt: item.created_at,
        }));

      return {
        id: row.id,
        orderNumber: row.order_number || 0,
        studentId: row.student_id,
        totalAmount: Number(row.total_amount || 0),
        status: row.status,
        pickupMethod: row.pickup_location_name || row.pickup_method || 'Canteen Pickup',
        pickupLocationId: row.pickup_location_id || undefined,
        pickupLocationName: row.pickup_location_name || row.pickup_method || undefined,
        createdAt: row.created_at,
        updatedAt: row.updated_at,
        cancelledAt: row.cancelled_at || undefined,
        pickupOtpVerifiedAt: row.pickup_otp_verified_at || undefined,
        items: orderItems,
      };
    });
  } catch (err) {
    console.error('[orderService] Exception during fetchWorkerOrders:', err);
    return [];
  }
}

export interface WeekRange {
  weekIndex: number;
  label: string;
  shortLabel: string;
  startDay: number;
  endDay: number;
  startIso: string;
  endIso: string;
}

/**
 * Calculates Week 1..Week 5 ranges dynamically for any given month and year.
 */
export function getMonthWeekRanges(year: number, month: number): WeekRange[] {
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const monthNameShort = new Date(year, month, 1).toLocaleString('en-US', { month: 'short' });

  const rawSegments = [
    { weekIndex: 0, startDay: 1, endDay: 7 },
    { weekIndex: 1, startDay: 8, endDay: 14 },
    { weekIndex: 2, startDay: 15, endDay: 21 },
    { weekIndex: 3, startDay: 22, endDay: 28 },
    { weekIndex: 4, startDay: 29, endDay: daysInMonth },
  ];

  return rawSegments
    .filter((seg) => seg.startDay <= daysInMonth)
    .map((seg) => {
      const actualEndDay = Math.min(seg.endDay, daysInMonth);
      const start = new Date(year, month, seg.startDay, 0, 0, 0, 0);
      const end = new Date(year, month, actualEndDay, 23, 59, 59, 999);

      return {
        weekIndex: seg.weekIndex,
        label: `Week ${seg.weekIndex + 1} (${monthNameShort} ${seg.startDay}–${actualEndDay})`,
        shortLabel: `Week ${seg.weekIndex + 1}`,
        startDay: seg.startDay,
        endDay: actualEndDay,
        startIso: start.toISOString(),
        endIso: end.toISOString(),
      };
    });
}

/**
 * Robust calculation of local start and end timestamps for HistoryFilterState.
 */
export function getFilterDateBoundaries(filterState: HistoryFilterState): { startIso?: string; endIso?: string } {
  const { mode, selectedYear, selectedMonth, selectedWeekIndex, selectedDate } = filterState;
  const now = new Date();

  if (mode === 'today') {
    const start = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0, 0);
    const end = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999);
    return { startIso: start.toISOString(), endIso: end.toISOString() };
  }

  if (mode === 'yesterday') {
    const yesterday = new Date(now);
    yesterday.setDate(yesterday.getDate() - 1);
    const start = new Date(yesterday.getFullYear(), yesterday.getMonth(), yesterday.getDate(), 0, 0, 0, 0);
    const end = new Date(yesterday.getFullYear(), yesterday.getMonth(), yesterday.getDate(), 23, 59, 59, 999);
    return { startIso: start.toISOString(), endIso: end.toISOString() };
  }

  if (mode === 'month') {
    const daysInMonth = new Date(selectedYear, selectedMonth + 1, 0).getDate();
    const start = new Date(selectedYear, selectedMonth, 1, 0, 0, 0, 0);
    const end = new Date(selectedYear, selectedMonth, daysInMonth, 23, 59, 59, 999);
    return { startIso: start.toISOString(), endIso: end.toISOString() };
  }

  if (mode === 'week') {
    const ranges = getMonthWeekRanges(selectedYear, selectedMonth);
    const idx = Math.min(Math.max(0, selectedWeekIndex || 0), ranges.length - 1);
    if (ranges[idx]) {
      return { startIso: ranges[idx].startIso, endIso: ranges[idx].endIso };
    }
  }

  if (mode === 'date' && selectedDate) {
    const parts = selectedDate.split('-').map(Number);
    if (parts.length === 3) {
      const [y, m, d] = parts;
      const start = new Date(y, m - 1, d, 0, 0, 0, 0);
      const end = new Date(y, m - 1, d, 23, 59, 59, 999);
      return { startIso: start.toISOString(), endIso: end.toISOString() };
    }
  }

  return {}; // 'all'
}

/**
 * Returns formatted heading text for history header.
 */
export function getFilterHeadingTitle(filterState: HistoryFilterState): string {
  const { mode, selectedYear, selectedMonth, selectedWeekIndex, selectedDate } = filterState;

  if (mode === 'today') {
    const dateStr = new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
    return `Delivered Orders — Today (${dateStr})`;
  }

  if (mode === 'yesterday') {
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    const dateStr = yesterday.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
    return `Delivered Orders — Yesterday (${dateStr})`;
  }

  if (mode === 'month') {
    const monthName = new Date(selectedYear, selectedMonth, 1).toLocaleString('en-US', { month: 'long' });
    return `Delivered Orders — ${monthName} ${selectedYear}`;
  }

  if (mode === 'week') {
    const ranges = getMonthWeekRanges(selectedYear, selectedMonth);
    const idx = Math.min(Math.max(0, selectedWeekIndex || 0), ranges.length - 1);
    const label = ranges[idx] ? ranges[idx].label : `Week ${(selectedWeekIndex || 0) + 1}`;
    return `Delivered Orders — ${label}, ${selectedYear}`;
  }

  if (mode === 'date' && selectedDate) {
    const parts = selectedDate.split('-').map(Number);
    if (parts.length === 3) {
      const [y, m, d] = parts;
      const dateStr = new Date(y, m - 1, d).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
      return `Delivered Orders — ${dateStr}`;
    }
  }

  return 'Delivered Orders — All History';
}

/**
 * Legacy compatibility helper for simple date filter key.
 */
export function getDateBoundaries(filter: HistoryDateFilter): { startIso?: string; endIso?: string } {
  const now = new Date();
  if (filter === 'today') {
    return getFilterDateBoundaries({ mode: 'today', selectedYear: now.getFullYear(), selectedMonth: now.getMonth() });
  }
  if (filter === 'yesterday') {
    return getFilterDateBoundaries({ mode: 'yesterday', selectedYear: now.getFullYear(), selectedMonth: now.getMonth() });
  }
  if (filter === 'this_week') {
    const weekAgo = new Date(now);
    weekAgo.setDate(weekAgo.getDate() - 6);
    return {
      startIso: new Date(weekAgo.getFullYear(), weekAgo.getMonth(), weekAgo.getDate(), 0, 0, 0, 0).toISOString(),
      endIso: new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999).toISOString(),
    };
  }
  if (filter === 'this_month') {
    return getFilterDateBoundaries({ mode: 'month', selectedYear: now.getFullYear(), selectedMonth: now.getMonth() });
  }
  return {};
}

export interface FetchOrderHistoryOptions {
  filterState: HistoryFilterState;
  searchQuery?: string;
  pickupLocationId?: string;
  page: number;
  pageSize: number;
}

export interface FetchOrderHistoryResult {
  orders: Order[];
  totalCount: number;
}

/**
 * Fetch paginated DELIVERED order history for Kitchen Staff with date filters and search.
 */
export async function fetchWorkerOrderHistory(
  options: FetchOrderHistoryOptions
): Promise<FetchOrderHistoryResult> {
  const { filterState, searchQuery, pickupLocationId, page, pageSize } = options;

  try {
    const { startIso, endIso } = getFilterDateBoundaries(filterState);
    const from = (page - 1) * pageSize;
    const to = from + pageSize - 1;

    // Primary attempt: query by delivered_at timestamp
    let query = supabase
      .from('orders')
      .select('id, order_number, student_id, total_amount, status, pickup_method, pickup_location_id, pickup_location_name, created_at, updated_at, cancelled_at, pickup_otp_verified_at, delivered_at', { count: 'exact' })
      .eq('status', 'delivered');

    if (pickupLocationId && pickupLocationId !== 'all') {
      query = query.eq('pickup_location_id', pickupLocationId);
    }

    if (startIso) {
      query = query.gte('delivered_at', startIso);
    }
    if (endIso) {
      query = query.lte('delivered_at', endIso);
    }

    if (searchQuery && searchQuery.trim() !== '') {
      const cleanDigits = searchQuery.replace(/\D/g, '');
      if (cleanDigits) {
        const orderNum = parseInt(cleanDigits, 10);
        if (!isNaN(orderNum)) {
          query = query.eq('order_number', orderNum);
        }
      } else {
        return { orders: [], totalCount: 0 };
      }
    }

    query = query.order('delivered_at', { ascending: false, nullsFirst: false }).range(from, to);

    let { data: ordersData, count, error } = await query;

    // Fallback: if delivered_at is not populated yet or query fails, query by created_at
    if (error || !ordersData || (ordersData.length === 0 && startIso)) {
      let fallbackQuery = supabase
        .from('orders')
        .select('id, order_number, student_id, total_amount, status, pickup_method, pickup_location_id, pickup_location_name, created_at, updated_at, cancelled_at, pickup_otp_verified_at, delivered_at', { count: 'exact' })
        .eq('status', 'delivered');

      if (pickupLocationId && pickupLocationId !== 'all') {
        fallbackQuery = fallbackQuery.eq('pickup_location_id', pickupLocationId);
      }

      if (startIso) fallbackQuery = fallbackQuery.gte('created_at', startIso);
      if (endIso) fallbackQuery = fallbackQuery.lte('created_at', endIso);

      if (searchQuery && searchQuery.trim() !== '') {
        const cleanDigits = searchQuery.replace(/\D/g, '');
        if (cleanDigits) {
          const orderNum = parseInt(cleanDigits, 10);
          if (!isNaN(orderNum)) fallbackQuery = fallbackQuery.eq('order_number', orderNum);
        }
      }

      fallbackQuery = fallbackQuery.order('created_at', { ascending: false }).range(from, to);
      const fallbackRes = await fallbackQuery;

      if (!fallbackRes.error && fallbackRes.data) {
        ordersData = fallbackRes.data;
        count = fallbackRes.count;
      }
    }

    if (!ordersData || ordersData.length === 0) {
      return { orders: [], totalCount: count || 0 };
    }

    const orderIds = ordersData.map((o) => o.id);

    // Fetch order_items for these specific historical orders
    const { data: itemsData, error: itemsError } = await supabase
      .from('order_items')
      .select('*')
      .in('order_id', orderIds);

    if (itemsError) {
      console.warn('[orderService] Error fetching order_items for history:', itemsError);
    }

    const allItems = itemsData || [];

    const orders: Order[] = ordersData.map((row) => {
      const orderItems: OrderItem[] = allItems
        .filter((item) => item.order_id === row.id)
        .map((item) => ({
          id: item.id,
          orderId: item.order_id,
          menuItemId: item.menu_item_id,
          itemName: item.item_name,
          unitPrice: Number(item.unit_price || 0),
          quantity: Number(item.quantity || 1),
          lineTotal: Number(item.line_total || 0),
          imageUrl: item.image_url,
          createdAt: item.created_at,
        }));

      return {
        id: row.id,
        orderNumber: row.order_number || 0,
        studentId: row.student_id,
        totalAmount: Number(row.total_amount || 0),
        status: row.status,
        pickupMethod: row.pickup_location_name || row.pickup_method || 'Canteen Pickup',
        pickupLocationId: row.pickup_location_id || undefined,
        pickupLocationName: row.pickup_location_name || row.pickup_method || undefined,
        createdAt: row.created_at,
        updatedAt: row.updated_at,
        cancelledAt: row.cancelled_at || undefined,
        pickupOtpVerifiedAt: row.pickup_otp_verified_at || undefined,
        deliveredAt: row.delivered_at || undefined,
        items: orderItems,
      };
    });

    return { orders, totalCount: count || 0 };
  } catch (err) {
    console.error('[orderService] Exception during fetchWorkerOrderHistory:', err);
    return { orders: [], totalCount: 0 };
  }
}

/**
 * Export matching delivered order history to CSV for local save to device.
 */
export async function exportWorkerOrderHistoryCsv(
  options: Omit<FetchOrderHistoryOptions, 'page' | 'pageSize'>
): Promise<{ success: boolean; filename?: string; error?: string }> {
  const { filterState, searchQuery, pickupLocationId } = options;

  try {
    const { startIso, endIso } = getFilterDateBoundaries(filterState);

    let query = supabase
      .from('orders')
      .select('id, order_number, student_id, total_amount, status, pickup_method, pickup_location_id, pickup_location_name, created_at, updated_at, cancelled_at, pickup_otp_verified_at, delivered_at')
      .eq('status', 'delivered');

    if (pickupLocationId && pickupLocationId !== 'all') {
      query = query.eq('pickup_location_id', pickupLocationId);
    }

    if (startIso) {
      query = query.gte('delivered_at', startIso);
    }
    if (endIso) {
      query = query.lte('delivered_at', endIso);
    }

    if (searchQuery && searchQuery.trim() !== '') {
      const cleanDigits = searchQuery.replace(/\D/g, '');
      if (cleanDigits) {
        const orderNum = parseInt(cleanDigits, 10);
        if (!isNaN(orderNum)) {
          query = query.eq('order_number', orderNum);
        }
      } else {
        return { success: false, error: 'No delivered orders matched search query.' };
      }
    }

    query = query.order('delivered_at', { ascending: false, nullsFirst: false });

    let { data: ordersData, error } = await query;

    if (error || !ordersData || (ordersData.length === 0 && startIso)) {
      let fallbackQuery = supabase
        .from('orders')
        .select('id, order_number, student_id, total_amount, status, pickup_method, pickup_location_id, pickup_location_name, created_at, updated_at, cancelled_at, pickup_otp_verified_at, delivered_at')
        .eq('status', 'delivered');

      if (pickupLocationId && pickupLocationId !== 'all') {
        fallbackQuery = fallbackQuery.eq('pickup_location_id', pickupLocationId);
      }

      if (startIso) fallbackQuery = fallbackQuery.gte('created_at', startIso);
      if (endIso) fallbackQuery = fallbackQuery.lte('created_at', endIso);

      if (searchQuery && searchQuery.trim() !== '') {
        const cleanDigits = searchQuery.replace(/\D/g, '');
        if (cleanDigits) {
          const orderNum = parseInt(cleanDigits, 10);
          if (!isNaN(orderNum)) fallbackQuery = fallbackQuery.eq('order_number', orderNum);
        }
      }

      fallbackQuery = fallbackQuery.order('created_at', { ascending: false });
      const fallbackRes = await fallbackQuery;

      if (!fallbackRes.error && fallbackRes.data) {
        ordersData = fallbackRes.data;
      }
    }

    if (error || !ordersData || ordersData.length === 0) {
      return { success: false, error: 'No delivered orders available to export for the selected filter.' };
    }

    const orderIds = ordersData.map((o) => o.id);
    const { data: itemsData } = await supabase
      .from('order_items')
      .select('*')
      .in('order_id', orderIds);

    const allItems = itemsData || [];

    // CSV Header
    const csvRows: string[] = [
      'Order Number,Date,Time,Status,Pickup Location,Delivered/Verified Time,Items & Quantities,Total Amount (INR)',
    ];

    for (const row of ordersData) {
      const orderDate = new Date(row.created_at);
      const dateStr = orderDate.toLocaleDateString('en-US');
      const timeStr = orderDate.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });

      let deliveredTimeStr = 'N/A';
      const delTimestamp = row.delivered_at || row.pickup_otp_verified_at || row.updated_at;
      if (delTimestamp) {
        const delDate = new Date(delTimestamp);
        deliveredTimeStr = `${delDate.toLocaleDateString('en-US')} ${delDate.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })}`;
      }

      const orderItems = allItems.filter((i) => i.order_id === row.id);
      const itemsSummary = orderItems
        .map((i) => `${i.quantity}x ${i.item_name.replace(/"/g, '""')}`)
        .join('; ');

      const line = [
        `"#${row.order_number}"`,
        `"${dateStr}"`,
        `"${timeStr}"`,
        `"${row.status}"`,
        `"${row.pickup_location_name || row.pickup_method || 'Canteen Pickup'}"`,
        `"${deliveredTimeStr}"`,
        `"${itemsSummary}"`,
        `"${Number(row.total_amount || 0).toFixed(2)}"`,
      ].join(',');

      csvRows.push(line);
    }

    const csvContent = csvRows.join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);

    const dateStr = new Date().toISOString().split('T')[0];
    const filename = `smart-canteen-order-history-${dateStr}.csv`;

    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', filename);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);

    return { success: true, filename };
  } catch (err) {
    console.error('[orderService] Exception exporting CSV:', err);
    return { success: false, error: 'Failed to generate CSV export.' };
  }
}

/**
 * Update an order's status as a canteen worker via secure Supabase stored procedure `update_order_status`.
 * Workflow transitions: placed -> ready -> delivered.
 */
export async function updateOrderStatusByWorker(
  orderId: string,
  newStatus: string
): Promise<{ success: boolean; error?: string }> {
  if (!orderId || !newStatus) {
    return { success: false, error: 'Invalid order ID or new status specified.' };
  }

  try {
    const { data, error } = await supabase.rpc('update_order_status', {
      p_order_id: orderId,
      p_new_status: newStatus,
    });

    if (error) {
      console.warn('[orderService] Supabase RPC update_order_status error:', error);

      if (error.code === 'PGRST202' || error.code === '42883' || error.message.includes('Could not find')) {
        return {
          success: false,
          error:
            'Order workflow migration (009_order_status_placed_ready_delivered.sql) has not been run in Supabase. Please execute database/migrations/009_order_status_placed_ready_delivered.sql in your Supabase SQL Editor.',
        };
      }

      return {
        success: false,
        error: error.message || 'Failed to update order status. Please try again.',
      };
    }

    if (!data || !data.success) {
      return {
        success: false,
        error: (data && data.error) || 'Failed to update order status.',
      };
    }

    return { success: true };
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Unknown network error updating order status';
    console.error('[orderService] Exception during updateOrderStatusByWorker:', err);
    return {
      success: false,
      error: msg,
    };
  }
}

/**
 * Verify a student's 4-digit pickup OTP as a canteen worker via secure Supabase stored procedure `verify_pickup_otp`.
 * Workflow transition: ready -> delivered.
 */
export async function verifyPickupOtp(
  orderId: string,
  otp: string
): Promise<{ success: boolean; error?: string }> {
  if (!orderId || !otp) {
    return { success: false, error: 'Invalid order ID or OTP specified.' };
  }

  const cleanOtp = otp.trim();
  if (!/^\d{4}$/.test(cleanOtp)) {
    return { success: false, error: 'OTP must be exactly 4 numeric digits.' };
  }

  try {
    const { data, error } = await supabase.rpc('verify_pickup_otp', {
      p_order_id: orderId,
      p_otp: cleanOtp,
    });

    if (error) {
      console.warn('[orderService] Supabase RPC verify_pickup_otp error:', error);

      if (error.code === 'PGRST202' || error.code === '42883' || error.message.includes('Could not find')) {
        return {
          success: false,
          error:
            'OTP verification migration (010_pickup_otp.sql) has not been run in Supabase. Please execute database/migrations/010_pickup_otp.sql in your Supabase SQL Editor.',
        };
      }

      return {
        success: false,
        error: error.message || 'Invalid pickup OTP.',
      };
    }

    if (!data || !data.success) {
      return {
        success: false,
        error: (data && data.error) || 'Failed to verify pickup OTP.',
      };
    }

    return { success: true };
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Unknown network error verifying OTP';
    console.error('[orderService] Exception during verifyPickupOtp:', err);
    return {
      success: false,
      error: msg,
    };
  }
}

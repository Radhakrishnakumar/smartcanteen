export type UserRole = 'student' | 'worker' | 'admin';

export interface UserProfile {
  id: string;
  fullName: string;
  email: string;
  role: UserRole;
}

export type OrderStatus = 'placed' | 'ready' | 'delivered' | 'cancelled';

export type RealtimeConnectionStatus = 'connected' | 'reconnecting' | 'disconnected';

export type HistoryDateFilter = 'today' | 'yesterday' | 'this_week' | 'this_month' | 'all';

export type HistoryFilterMode = 'today' | 'yesterday' | 'month' | 'week' | 'date' | 'all';

export interface HistoryFilterState {
  mode: HistoryFilterMode;
  selectedYear: number;
  selectedMonth: number; // 0-indexed: 0 = Jan, 11 = Dec
  selectedWeekIndex?: number; // 0..4 (Week 1 to Week 5)
  selectedDate?: string; // YYYY-MM-DD format
}

export interface PickupLocation {
  id: string;
  name: string;
  code: string;
  description?: string;
  isActive: boolean;
  createdAt?: string;
  updatedAt?: string;
}

export type ConfidenceLevel = 'High' | 'Medium' | 'Low';

export interface OrderEtaPrediction {
  orderId: string;
  status: OrderStatus;
  isActive: boolean;
  pickupLocationId?: string | null;
  pickupLocationName?: string;
  queuePosition: number;
  ordersAhead: number;
  estimatedMinutes: number;
  formattedRange: string;
  estimatedReadyAt?: string;
  confidenceLevel: ConfidenceLevel;
  expectedAround?: string;
  error?: string;
}

export interface OrderPreparationMetric {
  id: string;
  orderId: string;
  pickupLocationId?: string;
  preparationSeconds: number;
  itemCount: number;
  totalQuantity: number;
  createdAt: string;
  completedAt: string;
}

export interface Order {
  id: string;
  orderNumber: number;
  studentId: string;
  totalAmount: number;
  status: OrderStatus;
  pickupMethod: string;
  pickupLocationId?: string | null;
  pickupLocationName?: string | null;
  createdAt: string;
  updatedAt: string;
  cancelledAt?: string;
  pickupOtp?: string | null;
  pickupOtpVerifiedAt?: string | null;
  deliveredAt?: string | null;
  items?: OrderItem[];
  eta?: OrderEtaPrediction;
}

export interface OrderItem {
  id: string;
  orderId: string;
  menuItemId?: string;
  itemName: string;
  unitPrice: number;
  quantity: number;
  lineTotal: number;
  imageUrl?: string;
  createdAt: string;
}

export interface CreateOrderResult {
  success: boolean;
  orderId?: string;
  orderNumber?: number;
  totalAmount?: number;
  pickupOtp?: string;
  pickupLocationId?: string;
  pickupLocationName?: string;
  error?: string;
}

export interface MenuItemPlaceholder {
  id: string;
  name: string;
  category: string;
  price: number;
  description: string;
  available: boolean;
  image?: string;
}

export interface OrderQueueItemPlaceholder {
  id: string;
  orderNumber: number;
  studentName: string;
  items: string[];
  totalAmount: number;
  status: 'placed' | 'ready' | 'delivered';
  slotTime: string;
  placedAt: string;
}

export interface BackendHealthResponse {
  status: string;
  timestamp: string;
  service: string;
  version: string;
  uptime: number;
  environment: string;
}


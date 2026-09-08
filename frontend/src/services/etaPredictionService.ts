import { supabase } from './supabase';
import { OrderEtaPrediction, ConfidenceLevel } from '../types';

/**
 * Fetch dynamic AI-assisted/statistical ETA prediction for a student order.
 * Calls secure Supabase stored procedure `get_order_eta(p_order_id)`.
 */
export async function fetchOrderEta(orderId: string): Promise<OrderEtaPrediction | null> {
  if (!orderId) return null;

  try {
    const { data, error } = await supabase.rpc('get_order_eta', {
      p_order_id: orderId,
    });

    if (error) {
      console.warn('[etaPredictionService] Supabase RPC get_order_eta error:', error);
      return null;
    }

    if (!data) return null;

    const confidence: ConfidenceLevel =
      data.confidence_level === 'High' || data.confidence_level === 'Medium'
        ? data.confidence_level
        : 'Low';

    return {
      orderId: data.order_id || orderId,
      status: data.status || 'placed',
      isActive: Boolean(data.is_active),
      pickupLocationId: data.pickup_location_id || null,
      pickupLocationName: data.pickup_location_name || 'Canteen Pickup',
      queuePosition: Number(data.queue_position || 1),
      ordersAhead: Number(data.orders_ahead || 0),
      estimatedMinutes: Number(data.estimated_minutes || 0),
      formattedRange: data.formatted_range || '10–15 min',
      estimatedReadyAt: data.estimated_ready_at || undefined,
      confidenceLevel: confidence,
      expectedAround: data.expected_around || undefined,
    };
  } catch (err) {
    console.error('[etaPredictionService] Exception during fetchOrderEta:', err);
    return null;
  }
}

/**
 * Helper to return UI styling badge classes for confidence levels.
 */
export function getConfidenceBadgeStyle(confidence: ConfidenceLevel): {
  bgClass: string;
  textClass: string;
  borderClass: string;
  label: string;
} {
  switch (confidence) {
    case 'High':
      return {
        bgClass: 'bg-emerald-50 text-emerald-800',
        textClass: 'text-emerald-700',
        borderClass: 'border-emerald-200',
        label: 'High Confidence',
      };
    case 'Medium':
      return {
        bgClass: 'bg-blue-50 text-blue-800',
        textClass: 'text-blue-700',
        borderClass: 'border-blue-200',
        label: 'Medium Confidence',
      };
    case 'Low':
    default:
      return {
        bgClass: 'bg-amber-50 text-amber-900',
        textClass: 'text-amber-800',
        borderClass: 'border-amber-200',
        label: 'Baseline Prediction',
      };
  }
}

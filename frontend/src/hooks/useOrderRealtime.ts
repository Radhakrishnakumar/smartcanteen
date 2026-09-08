import { useEffect, useState, useRef } from 'react';
import { supabase } from '../services/supabase';
import { RealtimeConnectionStatus } from '../types';
import { RealtimeChannel } from '@supabase/supabase-js';

export interface RealtimeOrderPayload {
  eventType: 'INSERT' | 'UPDATE' | 'DELETE' | string;
  newRecord: any;
  oldRecord: any;
}

/**
 * Custom React hook for Student Real-Time Order Synchronization.
 * Subscribes to postgres_changes on public.orders for the logged-in student.
 */
export function useStudentOrdersRealtime(
  studentId: string | undefined,
  onOrderChange: (payload: RealtimeOrderPayload) => void
): { status: RealtimeConnectionStatus } {
  const [status, setStatus] = useState<RealtimeConnectionStatus>('reconnecting');
  const callbackRef = useRef(onOrderChange);

  useEffect(() => {
    callbackRef.current = onOrderChange;
  }, [onOrderChange]);

  useEffect(() => {
    if (!studentId) {
      setStatus('disconnected');
      return;
    }

    let channel: RealtimeChannel | null = null;
    const channelName = `student-orders-chan-${studentId}-${Math.random().toString(36).substring(2, 7)}`;

    try {
      channel = supabase
        .channel(channelName)
        .on(
          'postgres_changes',
          {
            event: '*',
            schema: 'public',
            table: 'orders',
            filter: `student_id=eq.${studentId}`,
          },
          (payload) => {
            const newRec = payload.new as any;
            const oldRec = payload.old as any;
            const belongsToStudent =
              (newRec && newRec.student_id === studentId) ||
              (oldRec && oldRec.student_id === studentId);

            if (belongsToStudent) {
              callbackRef.current({
                eventType: payload.eventType,
                newRecord: newRec,
                oldRecord: oldRec,
              });
            }
          }
        )
        .subscribe((subscriptionStatus) => {
          if (subscriptionStatus === 'SUBSCRIBED') {
            setStatus('connected');
          } else if (subscriptionStatus === 'CLOSED' || subscriptionStatus === 'CHANNEL_ERROR') {
            setStatus('disconnected');
          } else {
            setStatus('reconnecting');
          }
        });
    } catch (err) {
      console.warn('[useStudentOrdersRealtime] Subscription error:', err);
      setStatus('disconnected');
    }

    return () => {
      if (channel) {
        supabase.removeChannel(channel);
      }
    };
  }, [studentId]);

  return { status };
}

/**
 * Custom React hook for Worker Kitchen Queue Real-Time Synchronization.
 * Subscribes to active order events on public.orders.
 */
export function useWorkerOrdersRealtime(
  onOrderChange: (payload: RealtimeOrderPayload) => void
): { status: RealtimeConnectionStatus } {
  const [status, setStatus] = useState<RealtimeConnectionStatus>('reconnecting');
  const callbackRef = useRef(onOrderChange);

  useEffect(() => {
    callbackRef.current = onOrderChange;
  }, [onOrderChange]);

  useEffect(() => {
    let channel: RealtimeChannel | null = null;
    const channelName = `worker-orders-chan-${Math.random().toString(36).substring(2, 7)}`;

    try {
      channel = supabase
        .channel(channelName)
        .on(
          'postgres_changes',
          {
            event: '*',
            schema: 'public',
            table: 'orders',
          },
          (payload) => {
            callbackRef.current({
              eventType: payload.eventType,
              newRecord: payload.new,
              oldRecord: payload.old,
            });
          }
        )
        .subscribe((subscriptionStatus) => {
          if (subscriptionStatus === 'SUBSCRIBED') {
            setStatus('connected');
          } else if (subscriptionStatus === 'CLOSED' || subscriptionStatus === 'CHANNEL_ERROR') {
            setStatus('disconnected');
          } else {
            setStatus('reconnecting');
          }
        });
    } catch (err) {
      console.warn('[useWorkerOrdersRealtime] Subscription error:', err);
      setStatus('disconnected');
    }

    return () => {
      if (channel) {
        supabase.removeChannel(channel);
      }
    };
  }, []);

  return { status };
}

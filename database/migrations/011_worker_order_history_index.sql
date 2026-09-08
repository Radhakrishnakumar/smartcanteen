-- =======================================================
-- SMART CANTEEN - MIGRATION 011: WORKER ORDER HISTORY INDEX & DELIVERED_AT COLUMN
-- File: database/migrations/011_worker_order_history_index.sql
-- =======================================================

-- 1. Add delivered_at column to public.orders if not exists
ALTER TABLE public.orders
ADD COLUMN IF NOT EXISTS delivered_at TIMESTAMP WITH TIME ZONE DEFAULT NULL;

-- 2. Backfill delivered_at for existing delivered orders
UPDATE public.orders
SET delivered_at = COALESCE(pickup_otp_verified_at, updated_at, created_at)
WHERE status = 'delivered' AND delivered_at IS NULL;

-- 3. Create performance index for filtering delivered orders by date boundaries
CREATE INDEX IF NOT EXISTS idx_orders_status_delivered_at 
ON public.orders(status, delivered_at DESC);

CREATE INDEX IF NOT EXISTS idx_orders_status_created_at 
ON public.orders(status, created_at DESC);

-- 4. Create performance index for order_number search queries
CREATE INDEX IF NOT EXISTS idx_orders_order_number 
ON public.orders(order_number);

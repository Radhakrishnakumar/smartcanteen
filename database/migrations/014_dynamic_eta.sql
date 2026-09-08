-- =======================================================
-- SMART CANTEEN - MIGRATION 014: AI-ASSISTED DYNAMIC ETA SYSTEM
-- File: database/migrations/014_dynamic_eta.sql
-- =======================================================

-- 1. Create order_preparation_metrics Table
-- Stores historical preparation durations (placed -> ready) for learning
CREATE TABLE IF NOT EXISTS public.order_preparation_metrics (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    order_id UUID UNIQUE NOT NULL REFERENCES public.orders(id) ON DELETE CASCADE,
    pickup_location_id UUID REFERENCES public.pickup_locations(id) ON DELETE SET NULL,
    preparation_seconds INTEGER NOT NULL CHECK (preparation_seconds > 0),
    item_count INTEGER NOT NULL DEFAULT 1 CHECK (item_count > 0),
    total_quantity INTEGER NOT NULL DEFAULT 1 CHECK (total_quantity > 0),
    created_at TIMESTAMP WITH TIME ZONE NOT NULL,
    completed_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 2. Create order_eta_predictions Table
-- Stores live predictions, queue positions, and confidence metrics
CREATE TABLE IF NOT EXISTS public.order_eta_predictions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    order_id UUID UNIQUE NOT NULL REFERENCES public.orders(id) ON DELETE CASCADE,
    pickup_location_id UUID REFERENCES public.pickup_locations(id) ON DELETE SET NULL,
    estimated_minutes INTEGER NOT NULL CHECK (estimated_minutes >= 0),
    estimated_ready_at TIMESTAMP WITH TIME ZONE NOT NULL,
    confidence_level TEXT NOT NULL CHECK (confidence_level IN ('High', 'Medium', 'Low')),
    calculation_version TEXT NOT NULL DEFAULT 'v1.0-statistical',
    queue_position INTEGER NOT NULL CHECK (queue_position >= 1),
    orders_ahead INTEGER NOT NULL CHECK (orders_ahead >= 0),
    estimated_work_minutes INTEGER NOT NULL CHECK (estimated_work_minutes >= 0),
    historical_factor NUMERIC(5, 2) DEFAULT 1.0,
    queue_factor NUMERIC(5, 2) DEFAULT 1.0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 3. Create Performance Indexes for Live Queue & Historical Aggregations
CREATE INDEX IF NOT EXISTS idx_orders_queue_loc_status_created 
ON public.orders(pickup_location_id, status, created_at);

CREATE INDEX IF NOT EXISTS idx_prep_metrics_loc_completed 
ON public.order_preparation_metrics(pickup_location_id, completed_at);

CREATE INDEX IF NOT EXISTS idx_eta_predictions_order 
ON public.order_eta_predictions(order_id);

CREATE INDEX IF NOT EXISTS idx_eta_predictions_loc 
ON public.order_eta_predictions(pickup_location_id);

-- 4. Enable Row-Level Security (RLS)
ALTER TABLE public.order_preparation_metrics ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.order_eta_predictions ENABLE ROW LEVEL SECURITY;

-- 5. RLS Policies for order_preparation_metrics
DROP POLICY IF EXISTS "Workers can view preparation metrics" ON public.order_preparation_metrics;
CREATE POLICY "Workers can view preparation metrics"
ON public.order_preparation_metrics FOR SELECT
USING (
    EXISTS (
        SELECT 1 FROM public.profiles
        WHERE (user_id = auth.uid() OR id = auth.uid()) AND role = 'worker'
    )
);

-- 6. RLS Policies for order_eta_predictions
DROP POLICY IF EXISTS "Students and workers can view order ETA predictions" ON public.order_eta_predictions;
CREATE POLICY "Students and workers can view order ETA predictions"
ON public.order_eta_predictions FOR SELECT
USING (
    EXISTS (
        SELECT 1 FROM public.orders
        WHERE orders.id = order_eta_predictions.order_id AND orders.student_id = auth.uid()
    ) OR
    EXISTS (
        SELECT 1 FROM public.profiles
        WHERE (user_id = auth.uid() OR id = auth.uid()) AND role = 'worker'
    )
);

-- 7. Update Worker Status Transition Stored Procedure to Record Preparation Metrics
CREATE OR REPLACE FUNCTION public.update_order_status(
    p_order_id UUID,
    p_new_status TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_worker_id UUID;
    v_order RECORD;
    v_prep_seconds INT;
    v_item_count INT;
    v_total_qty INT;
BEGIN
    -- 1. Verify user authentication
    v_worker_id := auth.uid();
    IF v_worker_id IS NULL THEN
        RAISE EXCEPTION 'Unauthorized: User must be authenticated to update order status.' USING ERRCODE = '42501';
    END IF;

    -- 2. Verify worker role in profiles table
    IF NOT EXISTS (
        SELECT 1 FROM public.profiles
        WHERE (user_id = v_worker_id OR id = v_worker_id) AND role = 'worker'
    ) THEN
        RAISE EXCEPTION 'Unauthorized: Only canteen kitchen staff can update order status.' USING ERRCODE = '42501';
    END IF;

    -- 3. Query current order record
    SELECT id, status, created_at, pickup_location_id INTO v_order
    FROM public.orders
    WHERE id = p_order_id;

    IF NOT FOUND OR v_order.id IS NULL THEN
        RAISE EXCEPTION 'Order not found.' USING ERRCODE = 'P0002';
    END IF;

    -- 4. No-op if status is already updated
    IF v_order.status = p_new_status THEN
        RETURN jsonb_build_object(
            'success', true,
            'order_id', p_order_id,
            'old_status', v_order.status,
            'new_status', p_new_status,
            'message', 'Order status is already up to date.'
        );
    END IF;

    -- 5. Terminal state checks
    IF v_order.status = 'cancelled' THEN
        RAISE EXCEPTION 'Cannot update status. This order was cancelled by the student.' USING ERRCODE = '22000';
    ELSIF v_order.status = 'delivered' THEN
        RAISE EXCEPTION 'Cannot update status. This order is already delivered.' USING ERRCODE = '22000';
    END IF;

    -- 6. Enforce valid worker transition: strictly placed -> ready
    IF v_order.status = 'placed' AND p_new_status = 'ready' THEN
        -- Valid transition
        NULL;
    ELSIF v_order.status = 'ready' AND p_new_status = 'delivered' THEN
        RAISE EXCEPTION 'Direct transition to delivered is restricted. Delivery completion requires OTP verification.' USING ERRCODE = '22000';
    ELSE
        RAISE EXCEPTION 'Invalid status transition from "%" to "%". Kitchen workflow must follow: placed -> ready.', v_order.status, p_new_status USING ERRCODE = '22000';
    END IF;

    -- 7. Perform status update
    UPDATE public.orders
    SET status = p_new_status,
        updated_at = NOW()
    WHERE id = p_order_id;

    -- 8. Record actual preparation metrics if moving placed -> ready
    IF v_order.status = 'placed' AND p_new_status = 'ready' THEN
        v_prep_seconds := GREATEST(1, EXTRACT(EPOCH FROM (NOW() - v_order.created_at))::INT);

        SELECT 
            COALESCE(COUNT(DISTINCT menu_item_id), 1),
            COALESCE(SUM(quantity), 1)
        INTO v_item_count, v_total_qty
        FROM public.order_items
        WHERE order_id = p_order_id;

        INSERT INTO public.order_preparation_metrics (
            order_id,
            pickup_location_id,
            preparation_seconds,
            item_count,
            total_quantity,
            created_at,
            completed_at
        ) VALUES (
            p_order_id,
            v_order.pickup_location_id,
            v_prep_seconds,
            v_item_count,
            v_total_qty,
            v_order.created_at,
            NOW()
        )
        ON CONFLICT (order_id) DO UPDATE SET
            preparation_seconds = EXCLUDED.preparation_seconds,
            completed_at = NOW();
    END IF;

    -- 9. Return success JSON
    RETURN jsonb_build_object(
        'success', true,
        'order_id', p_order_id,
        'old_status', v_order.status,
        'new_status', p_new_status
    );
END;
$$;

GRANT EXECUTE ON FUNCTION public.update_order_status(UUID, TEXT) TO authenticated;

-- 8. Create get_order_eta Stored Procedure
-- Calculates real-time queue position, orders ahead, historical prep time, and dynamic ETA
CREATE OR REPLACE FUNCTION public.get_order_eta(
    p_order_id UUID
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_user_id UUID;
    v_order RECORD;
    v_queue_pos INT := 1;
    v_orders_ahead INT := 0;
    v_avg_prep_sec NUMERIC;
    v_sample_count INT := 0;
    v_base_prep_mins INT := 10;
    v_confidence TEXT := 'Low';
    v_estimated_work_mins INT;
    v_estimated_mins INT;
    v_estimated_ready_at TIMESTAMP WITH TIME ZONE;
    v_min_range INT;
    v_max_range INT;
    v_formatted_range TEXT;
    v_expected_around TEXT;
BEGIN
    -- 1. Verify user authentication
    v_user_id := auth.uid();
    IF v_user_id IS NULL THEN
        RAISE EXCEPTION 'Unauthorized: User must be authenticated.' USING ERRCODE = '42501';
    END IF;

    -- 2. Fetch target order
    SELECT id, student_id, status, created_at, pickup_location_id, pickup_location_name
    INTO v_order
    FROM public.orders
    WHERE id = p_order_id;

    IF NOT FOUND OR v_order.id IS NULL THEN
        RAISE EXCEPTION 'Order not found.' USING ERRCODE = 'P0002';
    END IF;

    -- 3. Verify ownership or worker role
    IF v_order.student_id <> v_user_id AND NOT EXISTS (
        SELECT 1 FROM public.profiles
        WHERE (user_id = v_user_id OR id = v_user_id) AND role = 'worker'
    ) THEN
        RAISE EXCEPTION 'Unauthorized: You do not have permission to view ETA for this order.' USING ERRCODE = '42501';
    END IF;

    -- 4. If order is no longer in 'placed' status, return inactive status
    IF v_order.status <> 'placed' THEN
        RETURN jsonb_build_object(
            'success', true,
            'order_id', p_order_id,
            'status', v_order.status,
            'is_active', false,
            'pickup_location_id', v_order.pickup_location_id,
            'pickup_location_name', COALESCE(v_order.pickup_location_name, 'Canteen Pickup'),
            'queue_position', 0,
            'orders_ahead', 0,
            'estimated_minutes', 0,
            'formatted_range', CASE 
                WHEN v_order.status = 'ready' THEN 'READY FOR PICKUP'
                WHEN v_order.status = 'delivered' THEN 'DELIVERED'
                WHEN v_order.status = 'cancelled' THEN 'CANCELLED'
                ELSE UPPER(v_order.status)
            END
        );
    END IF;

    -- 5. Calculate FIFO queue position among active 'placed' orders at the SAME pickup location
    SELECT COUNT(*) + 1
    INTO v_queue_pos
    FROM public.orders
    WHERE (
        (pickup_location_id IS NULL AND v_order.pickup_location_id IS NULL) OR
        (pickup_location_id = v_order.pickup_location_id)
    )
    AND status = 'placed'
    AND (
        created_at < v_order.created_at OR
        (created_at = v_order.created_at AND id < p_order_id)
    );

    v_orders_ahead := GREATEST(0, v_queue_pos - 1);

    -- 6. Query historical preparation statistics for this location (excluding extreme outliers)
    IF v_order.pickup_location_id IS NOT NULL THEN
        SELECT 
            AVG(preparation_seconds),
            COUNT(*)
        INTO v_avg_prep_sec, v_sample_count
        FROM public.order_preparation_metrics
        WHERE pickup_location_id = v_order.pickup_location_id
          AND preparation_seconds BETWEEN 60 AND 3600
          AND completed_at >= (NOW() - INTERVAL '30 days');
    END IF;

    -- Fallback to overall canteen stats if location stats are sparse
    IF v_sample_count < 3 OR v_avg_prep_sec IS NULL THEN
        SELECT 
            AVG(preparation_seconds),
            COUNT(*)
        INTO v_avg_prep_sec, v_sample_count
        FROM public.order_preparation_metrics
        WHERE preparation_seconds BETWEEN 60 AND 3600
          AND completed_at >= (NOW() - INTERVAL '30 days');
    END IF;

    -- Determine confidence level & base prep time per order
    IF v_sample_count >= 10 AND v_avg_prep_sec IS NOT NULL THEN
        v_confidence := 'High';
        v_base_prep_mins := GREATEST(4, LEAST(25, ROUND(v_avg_prep_sec / 60.0)::INT));
    ELSIF v_sample_count BETWEEN 3 AND 9 AND v_avg_prep_sec IS NOT NULL THEN
        v_confidence := 'Medium';
        v_base_prep_mins := GREATEST(5, LEAST(25, ROUND(v_avg_prep_sec / 60.0)::INT));
    ELSE
        v_confidence := 'Low';
        v_base_prep_mins := 10;
    END IF;

    -- 7. Calculate estimated total work minutes with pipeline scaling factor (0.7x for orders ahead)
    v_estimated_work_mins := ROUND(v_orders_ahead * (v_base_prep_mins * 0.7) + v_base_prep_mins)::INT;
    v_estimated_mins := GREATEST(3, LEAST(60, v_estimated_work_mins));

    -- 8. Compute expected ready timestamp (at least 3 minutes from now)
    v_estimated_ready_at := GREATEST(NOW() + INTERVAL '3 minutes', v_order.created_at + (v_estimated_mins || ' minutes')::INTERVAL);

    -- Format display values
    v_min_range := GREATEST(2, v_estimated_mins - 2);
    v_max_range := v_estimated_mins + 3;
    v_formatted_range := v_min_range || '–' || v_max_range || ' min';
    v_expected_around := to_char(v_estimated_ready_at AT TIME ZONE 'Asia/Kolkata', 'HH12:MI AM');

    -- 9. Upsert prediction into order_eta_predictions
    INSERT INTO public.order_eta_predictions (
        order_id,
        pickup_location_id,
        estimated_minutes,
        estimated_ready_at,
        confidence_level,
        calculation_version,
        queue_position,
        orders_ahead,
        estimated_work_minutes,
        updated_at
    ) VALUES (
        p_order_id,
        v_order.pickup_location_id,
        v_estimated_mins,
        v_estimated_ready_at,
        v_confidence,
        'v1.0-statistical',
        v_queue_pos,
        v_orders_ahead,
        v_estimated_work_mins,
        NOW()
    )
    ON CONFLICT (order_id) DO UPDATE SET
        estimated_minutes = EXCLUDED.estimated_minutes,
        estimated_ready_at = EXCLUDED.estimated_ready_at,
        confidence_level = EXCLUDED.confidence_level,
        queue_position = EXCLUDED.queue_position,
        orders_ahead = EXCLUDED.orders_ahead,
        estimated_work_minutes = EXCLUDED.estimated_work_minutes,
        updated_at = NOW();

    -- 10. Return complete ETA JSONB payload
    RETURN jsonb_build_object(
        'success', true,
        'order_id', p_order_id,
        'status', 'placed',
        'is_active', true,
        'pickup_location_id', v_order.pickup_location_id,
        'pickup_location_name', COALESCE(v_order.pickup_location_name, 'Canteen Pickup'),
        'queue_position', v_queue_pos,
        'orders_ahead', v_orders_ahead,
        'estimated_minutes', v_estimated_mins,
        'formatted_range', v_formatted_range,
        'estimated_ready_at', v_estimated_ready_at,
        'confidence_level', v_confidence,
        'expected_around', v_expected_around
    );
EXCEPTION
    WHEN OTHERS THEN
        RAISE EXCEPTION '%', SQLERRM;
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_order_eta(UUID) TO authenticated;

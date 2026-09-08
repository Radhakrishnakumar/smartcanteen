-- =======================================================
-- SMART CANTEEN - MIGRATION 007: STUDENT ORDER CANCELLATION
-- File: database/migrations/007_student_order_cancellation.sql
-- =======================================================

-- 1. Add cancelled_at column to public.orders table if missing
ALTER TABLE public.orders
ADD COLUMN IF NOT EXISTS cancelled_at TIMESTAMP WITH TIME ZONE DEFAULT NULL;

-- 2. Create or Replace Atomic Cancellation Stored Procedure
CREATE OR REPLACE FUNCTION public.cancel_student_order(
    p_order_id UUID
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_student_id UUID;
    v_order_record RECORD;
BEGIN
    -- 1. Verify user authentication
    v_student_id := auth.uid();
    IF v_student_id IS NULL THEN
        RAISE EXCEPTION 'Unauthorized: User must be authenticated to cancel an order.';
    END IF;

    -- 2. Fetch order record
    SELECT id, student_id, status
    INTO v_order_record
    FROM public.orders
    WHERE id = p_order_id;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Order not found.';
    END IF;

    -- 3. Verify student ownership
    IF v_order_record.student_id <> v_student_id THEN
        RAISE EXCEPTION 'Unauthorized: You cannot cancel this order.';
    END IF;

    -- 4. Enforce cancellation eligibility (status MUST be strictly 'placed')
    IF v_order_record.status = 'preparing' THEN
        RAISE EXCEPTION 'This order can no longer be cancelled because preparation has started.';
    ELSIF v_order_record.status = 'cancelled' THEN
        RAISE EXCEPTION 'This order has already been cancelled.';
    ELSIF v_order_record.status <> 'placed' THEN
        RAISE EXCEPTION 'This order can no longer be cancelled.';
    END IF;

    -- 5. Perform atomic status update
    UPDATE public.orders
    SET status = 'cancelled',
        cancelled_at = NOW(),
        updated_at = NOW()
    WHERE id = p_order_id;

    -- 6. Return success result
    RETURN jsonb_build_object(
        'success', true,
        'order_id', p_order_id,
        'status', 'cancelled',
        'cancelled_at', NOW()
    );
EXCEPTION
    WHEN OTHERS THEN
        RAISE EXCEPTION '%', SQLERRM;
END;
$$;

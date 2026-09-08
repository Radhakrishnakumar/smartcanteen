-- =======================================================
-- SMART CANTEEN - MIGRATION 008: WORKER ORDER MANAGEMENT
-- File: database/migrations/008_worker_order_management.sql
-- =======================================================

-- 1. Create or Replace Atomic Status Update Stored Procedure for Kitchen Workers
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
    v_current_status TEXT;
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

    -- 3. Query current order status
    SELECT status INTO v_current_status
    FROM public.orders
    WHERE id = p_order_id;

    IF NOT FOUND OR v_current_status IS NULL THEN
        RAISE EXCEPTION 'Order not found.' USING ERRCODE = 'P0002';
    END IF;

    -- 4. No-op if status is already updated
    IF v_current_status = p_new_status THEN
        RETURN jsonb_build_object(
            'success', true,
            'order_id', p_order_id,
            'old_status', v_current_status,
            'new_status', p_new_status,
            'message', 'Order status is already up to date.'
        );
    END IF;

    -- 5. Terminal state checks
    IF v_current_status = 'cancelled' THEN
        RAISE EXCEPTION 'Cannot update status. This order was cancelled by the student.' USING ERRCODE = '22000';
    ELSIF v_current_status = 'completed' THEN
        RAISE EXCEPTION 'Cannot update status. This order is already completed.' USING ERRCODE = '22000';
    END IF;

    -- 6. Enforce valid sequential transitions: placed -> preparing -> ready -> completed
    IF v_current_status = 'placed' AND p_new_status = 'preparing' THEN
        -- Valid transition
        NULL;
    ELSIF v_current_status = 'preparing' AND p_new_status = 'ready' THEN
        -- Valid transition
        NULL;
    ELSIF v_current_status = 'ready' AND p_new_status = 'completed' THEN
        -- Valid transition
        NULL;
    ELSE
        RAISE EXCEPTION 'Invalid status transition from "%" to "%". Kitchen workflow must follow: placed -> preparing -> ready -> completed.', v_current_status, p_new_status USING ERRCODE = '22000';
    END IF;

    -- 7. Perform status update
    UPDATE public.orders
    SET status = p_new_status,
        updated_at = NOW()
    WHERE id = p_order_id;

    -- 8. Return success JSON
    RETURN jsonb_build_object(
        'success', true,
        'order_id', p_order_id,
        'old_status', v_current_status,
        'new_status', p_new_status
    );
END;
$$;

-- Grant execution permission to authenticated users (student checks handled inside procedure)
GRANT EXECUTE ON FUNCTION public.update_order_status(UUID, TEXT) TO authenticated;

-- =======================================================
-- SMART CANTEEN - MIGRATION 009: ORDER WORKFLOW REFACTOR
-- File: database/migrations/009_order_status_placed_ready_delivered.sql
-- =======================================================

-- 1. Safely Drop Existing Check Constraint on orders.status Column
DO $$
DECLARE
    r RECORD;
BEGIN
    -- Drop default constraint name explicitly if present
    ALTER TABLE public.orders DROP CONSTRAINT IF EXISTS orders_status_check;

    -- Safely drop any existing check constraints on public.orders that reference status
    FOR r IN
        SELECT con.conname
        FROM pg_catalog.pg_constraint con
        INNER JOIN pg_catalog.pg_class rel ON rel.oid = con.conrelid
        INNER JOIN pg_catalog.pg_namespace nsp ON nsp.oid = rel.relnamespace
        WHERE nsp.nspname = 'public'
          AND rel.relname = 'orders'
          AND con.contype = 'c'
          AND pg_get_constraintdef(con.oid) LIKE '%status%'
    LOOP
        EXECUTE 'ALTER TABLE public.orders DROP CONSTRAINT IF EXISTS ' || quote_ident(r.conname);
    END LOOP;
END $$;

-- 2. Migrate Existing Historical Orders to New Status Workflow
-- 'preparing' -> 'ready'
-- 'completed' -> 'delivered'
UPDATE public.orders
SET status = 'ready',
    updated_at = NOW()
WHERE status = 'preparing';

UPDATE public.orders
SET status = 'delivered',
    updated_at = NOW()
WHERE status = 'completed';

-- 3. Add Updated CHECK Constraint for Order Statuses
ALTER TABLE public.orders
ADD CONSTRAINT orders_status_check
CHECK (status IN ('placed', 'ready', 'delivered', 'cancelled'));

-- 4. Replace Atomic Status Update Stored Procedure for Kitchen Workers
-- Worker Workflow: ONLY placed -> ready is permitted via this RPC.
-- Transition from ready -> delivered will be handled securely via OTP Verification in future milestone.
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
    ELSIF v_current_status = 'delivered' THEN
        RAISE EXCEPTION 'Cannot update status. This order is already delivered.' USING ERRCODE = '22000';
    END IF;

    -- 6. Enforce valid worker transition: strictly placed -> ready
    IF v_current_status = 'placed' AND p_new_status = 'ready' THEN
        -- Valid transition
        NULL;
    ELSIF v_current_status = 'ready' AND p_new_status = 'delivered' THEN
        RAISE EXCEPTION 'Direct transition to delivered is restricted. Delivery completion requires OTP verification.' USING ERRCODE = '22000';
    ELSE
        RAISE EXCEPTION 'Invalid status transition from "%" to "%". Kitchen workflow must follow: placed -> ready.', v_current_status, p_new_status USING ERRCODE = '22000';
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

GRANT EXECUTE ON FUNCTION public.update_order_status(UUID, TEXT) TO authenticated;

-- 5. Replace Atomic Student Order Cancellation Procedure
-- Enforces that students can ONLY cancel orders in 'placed' status.
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
        RAISE EXCEPTION 'Unauthorized: User must be authenticated to cancel an order.' USING ERRCODE = '42501';
    END IF;

    -- 2. Fetch order record
    SELECT id, student_id, status
    INTO v_order_record
    FROM public.orders
    WHERE id = p_order_id;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Order not found.' USING ERRCODE = 'P0002';
    END IF;

    -- 3. Verify student ownership
    IF v_order_record.student_id <> v_student_id THEN
        RAISE EXCEPTION 'Unauthorized: You cannot cancel another student''s order.' USING ERRCODE = '42501';
    END IF;

    -- 4. Enforce cancellation eligibility (status MUST be strictly 'placed')
    IF v_order_record.status = 'ready' THEN
        RAISE EXCEPTION 'This order can no longer be cancelled because food is already ready at the counter.' USING ERRCODE = '22000';
    ELSIF v_order_record.status = 'delivered' THEN
        RAISE EXCEPTION 'This order has already been delivered and completed.' USING ERRCODE = '22000';
    ELSIF v_order_record.status = 'cancelled' THEN
        RAISE EXCEPTION 'This order has already been cancelled.' USING ERRCODE = '22000';
    ELSIF v_order_record.status <> 'placed' THEN
        RAISE EXCEPTION 'This order can no longer be cancelled.' USING ERRCODE = '22000';
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
END;
$$;

GRANT EXECUTE ON FUNCTION public.cancel_student_order(UUID) TO authenticated;

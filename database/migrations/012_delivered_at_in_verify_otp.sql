-- =======================================================
-- SMART CANTEEN - MIGRATION 012: DELIVERED_AT IN OTP VERIFICATION
-- File: database/migrations/012_delivered_at_in_verify_otp.sql
-- =======================================================

-- 1. Ensure delivered_at column exists on public.orders table
ALTER TABLE public.orders
ADD COLUMN IF NOT EXISTS delivered_at TIMESTAMP WITH TIME ZONE DEFAULT NULL;

-- 2. Safely Replace verify_pickup_otp Stored Procedure to populate delivered_at = NOW()
CREATE OR REPLACE FUNCTION public.verify_pickup_otp(
    p_order_id UUID,
    p_otp TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
    v_worker_id UUID;
    v_order_record RECORD;
BEGIN
    -- 1. Verify user authentication
    v_worker_id := auth.uid();
    IF v_worker_id IS NULL THEN
        RAISE EXCEPTION 'Unauthorized: User must be authenticated to verify pickup.' USING ERRCODE = '42501';
    END IF;

    -- 2. Verify worker role in public.profiles table
    IF NOT EXISTS (
        SELECT 1 FROM public.profiles
        WHERE (user_id = v_worker_id OR id = v_worker_id) AND role = 'worker'
    ) THEN
        RAISE EXCEPTION 'Unauthorized: Only canteen kitchen staff can verify pickup OTP.' USING ERRCODE = '42501';
    END IF;

    -- 3. Validate supplied OTP input format (must be exactly 4 numeric digits)
    IF p_otp IS NULL OR p_otp !~ '^[0-9]{4}$' THEN
        RAISE EXCEPTION 'Invalid OTP format. OTP must be exactly 4 numeric digits.' USING ERRCODE = '22000';
    END IF;

    -- 4. Lock order row for update to prevent concurrent race conditions
    SELECT id, order_number, status, pickup_otp
    INTO v_order_record
    FROM public.orders
    WHERE id = p_order_id
    FOR UPDATE;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Order not found.' USING ERRCODE = 'P0002';
    END IF;

    -- 5. Validate status preconditions
    IF v_order_record.status = 'delivered' THEN
        RAISE EXCEPTION 'Order has already been delivered.' USING ERRCODE = '22000';
    ELSIF v_order_record.status = 'cancelled' THEN
        RAISE EXCEPTION 'Cannot deliver a cancelled order.' USING ERRCODE = '22000';
    ELSIF v_order_record.status = 'placed' THEN
        RAISE EXCEPTION 'Order is placed. Kitchen staff must mark order READY before pickup verification.' USING ERRCODE = '22000';
    ELSIF v_order_record.status <> 'ready' THEN
        RAISE EXCEPTION 'Order is not ready for pickup.' USING ERRCODE = '22000';
    END IF;

    -- 6. Verify supplied OTP against stored OTP
    IF v_order_record.pickup_otp IS NULL OR v_order_record.pickup_otp <> p_otp THEN
        RAISE EXCEPTION 'Invalid pickup OTP.' USING ERRCODE = '22000';
    END IF;

    -- 7. Update order status atomically to delivered with delivered_at timestamp
    UPDATE public.orders
    SET status = 'delivered',
        delivered_at = NOW(),
        pickup_otp_verified_at = NOW(),
        updated_at = NOW()
    WHERE id = p_order_id;

    -- 8. Return success response (DO NOT expose pickup_otp to worker)
    RETURN jsonb_build_object(
        'success', true,
        'order_id', p_order_id,
        'order_number', v_order_record.order_number,
        'status', 'delivered',
        'delivered_at', NOW(),
        'verified_at', NOW()
    );
END;
$$;

GRANT EXECUTE ON FUNCTION public.verify_pickup_otp(UUID, TEXT) TO authenticated;

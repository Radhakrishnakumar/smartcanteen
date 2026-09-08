-- =======================================================
-- SMART CANTEEN - MIGRATION 010: 4-DIGIT PICKUP OTP
-- File: database/migrations/010_pickup_otp.sql
-- =======================================================

-- 1. Safely enable pgcrypto extension for cryptographically secure randomness
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- 2. Add Pickup OTP columns to public.orders table
ALTER TABLE public.orders
ADD COLUMN IF NOT EXISTS pickup_otp TEXT NULL,
ADD COLUMN IF NOT EXISTS pickup_otp_verified_at TIMESTAMP WITH TIME ZONE DEFAULT NULL;

-- 3. Update Atomic Order Creation Stored Procedure with Cryptographically Secure OTP Generation
CREATE OR REPLACE FUNCTION public.create_student_order(
    p_cart_items JSONB
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
    v_student_id UUID;
    v_order_id UUID;
    v_order_number INT;
    v_total_amount NUMERIC(10, 2) := 0;
    v_item JSONB;
    v_menu_item_id UUID;
    v_qty INT;
    v_menu_record RECORD;
    v_line_total NUMERIC(10, 2);
    v_random_bytes BYTEA;
    v_raw_int INT;
    v_pickup_otp TEXT;
BEGIN
    -- 1. Verify user authentication
    v_student_id := auth.uid();
    IF v_student_id IS NULL THEN
        RAISE EXCEPTION 'Unauthorized: User must be authenticated to place an order.' USING ERRCODE = '42501';
    END IF;

    -- 2. Validate input array
    IF p_cart_items IS NULL OR jsonb_array_length(p_cart_items) = 0 THEN
        RAISE EXCEPTION 'Cart is empty. Please add items to your cart before placing an order.' USING ERRCODE = '22000';
    END IF;

    -- 3. Calculate authoritative total & verify stock/active status for all items
    FOR v_item IN SELECT * FROM jsonb_array_elements(p_cart_items)
    LOOP
        v_menu_item_id := (v_item->>'menu_item_id')::UUID;
        v_qty := (v_item->>'quantity')::INT;

        IF v_qty IS NULL OR v_qty <= 0 THEN
            RAISE EXCEPTION 'Invalid item quantity specified.' USING ERRCODE = '22000';
        END IF;

        -- Fetch menu item from database
        SELECT id, name, price, is_available, is_active, image_url
        INTO v_menu_record
        FROM public.menu_items
        WHERE id = v_menu_item_id;

        IF NOT FOUND THEN
            RAISE EXCEPTION 'One or more items in your cart no longer exist in the menu database.' USING ERRCODE = 'P0002';
        END IF;

        IF v_menu_record.is_active IS FALSE THEN
            RAISE EXCEPTION 'Item "%" has been removed from the canteen menu by kitchen staff.', v_menu_record.name USING ERRCODE = '22000';
        END IF;

        IF v_menu_record.is_available IS FALSE THEN
            RAISE EXCEPTION 'Item "%" is currently Out of Stock.', v_menu_record.name USING ERRCODE = '22000';
        END IF;

        v_line_total := v_menu_record.price * v_qty;
        v_total_amount := v_total_amount + v_line_total;
    END LOOP;

    -- 4. Generate Cryptographically Secure 4-Digit Pickup OTP (0000 - 9999) using pgcrypto gen_random_bytes
    LOOP
        v_random_bytes := gen_random_bytes(2);
        v_raw_int := (get_byte(v_random_bytes, 0) * 256) + get_byte(v_random_bytes, 1);
        EXIT WHEN v_raw_int < 60000;
    END LOOP;
    v_pickup_otp := lpad((v_raw_int % 10000)::text, 4, '0');

    -- 5. Create Order Header Record
    INSERT INTO public.orders (
        student_id,
        total_amount,
        status,
        pickup_method,
        pickup_otp
    ) VALUES (
        v_student_id,
        v_total_amount,
        'placed',
        'Canteen Pickup',
        v_pickup_otp
    )
    RETURNING id, order_number INTO v_order_id, v_order_number;

    -- 6. Create Order Item Snapshot Records
    FOR v_item IN SELECT * FROM jsonb_array_elements(p_cart_items)
    LOOP
        v_menu_item_id := (v_item->>'menu_item_id')::UUID;
        v_qty := (v_item->>'quantity')::INT;

        SELECT id, name, price, image_url
        INTO v_menu_record
        FROM public.menu_items
        WHERE id = v_menu_item_id;

        v_line_total := v_menu_record.price * v_qty;

        INSERT INTO public.order_items (
            order_id,
            menu_item_id,
            item_name,
            unit_price,
            quantity,
            line_total,
            image_url
        ) VALUES (
            v_order_id,
            v_menu_item_id,
            v_menu_record.name,
            v_menu_record.price,
            v_qty,
            v_line_total,
            v_menu_record.image_url
        );
    END LOOP;

    -- 7. Return success response with OTP for the student
    RETURN jsonb_build_object(
        'success', true,
        'order_id', v_order_id,
        'order_number', v_order_number,
        'total_amount', v_total_amount,
        'pickup_otp', v_pickup_otp
    );
EXCEPTION
    WHEN OTHERS THEN
        RAISE EXCEPTION '%', SQLERRM;
END;
$$;

GRANT EXECUTE ON FUNCTION public.create_student_order(JSONB) TO authenticated;

-- 4. Atomic Stored Procedure for Kitchen Staff Pickup OTP Verification
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

    -- 7. Update order status atomically to delivered
    UPDATE public.orders
    SET status = 'delivered',
        pickup_otp_verified_at = NOW(),
        updated_at = NOW()
    WHERE id = p_order_id;

    -- 8. Return success response (DO NOT expose pickup_otp to worker)
    RETURN jsonb_build_object(
        'success', true,
        'order_id', p_order_id,
        'order_number', v_order_record.order_number,
        'status', 'delivered',
        'verified_at', NOW()
    );
END;
$$;

GRANT EXECUTE ON FUNCTION public.verify_pickup_otp(UUID, TEXT) TO authenticated;

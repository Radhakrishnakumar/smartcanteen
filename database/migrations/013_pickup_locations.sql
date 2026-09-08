-- =======================================================
-- SMART CANTEEN - MIGRATION 013: PICKUP LOCATIONS SYSTEM
-- File: database/migrations/013_pickup_locations.sql
-- =======================================================

-- 1. Create pickup_locations table if not exists
CREATE TABLE IF NOT EXISTS public.pickup_locations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    code TEXT NOT NULL UNIQUE,
    is_active BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 2. Seed initial active pickup locations idempotently
INSERT INTO public.pickup_locations (name, code, is_active)
VALUES
    ('Canteen 1', 'canteen-1', true),
    ('Canteen 2', 'canteen-2', true)
ON CONFLICT (code) DO NOTHING;

-- 3. Create Performance Index on code and is_active
CREATE INDEX IF NOT EXISTS idx_pickup_locations_active ON public.pickup_locations(is_active);

-- 4. Enable Row Level Security (RLS) on pickup_locations
ALTER TABLE public.pickup_locations ENABLE ROW LEVEL SECURITY;

-- 5. RLS Policies for pickup_locations
DROP POLICY IF EXISTS "Authenticated users can view active pickup locations" ON public.pickup_locations;
CREATE POLICY "Authenticated users can view active pickup locations"
ON public.pickup_locations FOR SELECT
USING (
    is_active = true OR
    EXISTS (
        SELECT 1 FROM public.profiles
        WHERE user_id = auth.uid() AND role = 'worker'
    )
);

DROP POLICY IF EXISTS "Workers can insert pickup locations" ON public.pickup_locations;
CREATE POLICY "Workers can insert pickup locations"
ON public.pickup_locations FOR INSERT
WITH CHECK (
    EXISTS (
        SELECT 1 FROM public.profiles
        WHERE user_id = auth.uid() AND role = 'worker'
    )
);

DROP POLICY IF EXISTS "Workers can update pickup locations" ON public.pickup_locations;
CREATE POLICY "Workers can update pickup locations"
ON public.pickup_locations FOR UPDATE
USING (
    EXISTS (
        SELECT 1 FROM public.profiles
        WHERE user_id = auth.uid() AND role = 'worker'
    )
)
WITH CHECK (
    EXISTS (
        SELECT 1 FROM public.profiles
        WHERE user_id = auth.uid() AND role = 'worker'
    )
);

-- 6. Modify public.orders to support pickup location reference & snapshot
ALTER TABLE public.orders
ADD COLUMN IF NOT EXISTS pickup_location_id UUID REFERENCES public.pickup_locations(id) NULL,
ADD COLUMN IF NOT EXISTS pickup_location_name TEXT NULL;

CREATE INDEX IF NOT EXISTS idx_orders_pickup_location ON public.orders(pickup_location_id);

-- 7. Update Atomic Order Creation Stored Procedure with Pickup Location Validation
CREATE OR REPLACE FUNCTION public.create_student_order(
    p_cart_items JSONB,
    p_pickup_location_id UUID DEFAULT NULL
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
    v_location_record RECORD;
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

    -- 2. Validate pickup location ID
    IF p_pickup_location_id IS NULL THEN
        RAISE EXCEPTION 'Please select a pickup location before placing an order.' USING ERRCODE = '22000';
    END IF;

    SELECT id, name, is_active
    INTO v_location_record
    FROM public.pickup_locations
    WHERE id = p_pickup_location_id;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Selected pickup location does not exist in the system.' USING ERRCODE = 'P0002';
    END IF;

    IF v_location_record.is_active IS FALSE THEN
        RAISE EXCEPTION 'Selected pickup location "%" is currently inactive.', v_location_record.name USING ERRCODE = '22000';
    END IF;

    -- 3. Validate input array
    IF p_cart_items IS NULL OR jsonb_array_length(p_cart_items) = 0 THEN
        RAISE EXCEPTION 'Cart is empty. Please add items to your cart before placing an order.' USING ERRCODE = '22000';
    END IF;

    -- 4. Calculate authoritative total & verify stock/active status for all items
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

    -- 5. Generate Cryptographically Secure 4-Digit Pickup OTP (0000 - 9999) using pgcrypto gen_random_bytes
    LOOP
        v_random_bytes := gen_random_bytes(2);
        v_raw_int := (get_byte(v_random_bytes, 0) * 256) + get_byte(v_random_bytes, 1);
        EXIT WHEN v_raw_int < 60000;
    END LOOP;
    v_pickup_otp := lpad((v_raw_int % 10000)::text, 4, '0');

    -- 6. Create Order Header Record with Pickup Location Snapshot & Preserve pickup_method = 'Canteen Pickup'
    INSERT INTO public.orders (
        student_id,
        total_amount,
        status,
        pickup_method,
        pickup_location_id,
        pickup_location_name,
        pickup_otp
    ) VALUES (
        v_student_id,
        v_total_amount,
        'placed',
        'Canteen Pickup',
        v_location_record.id,
        v_location_record.name,
        v_pickup_otp
    )
    RETURNING id, order_number INTO v_order_id, v_order_number;

    -- 7. Create Order Item Snapshot Records
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

    -- 8. Return success response with OTP & pickup location details for the student
    RETURN jsonb_build_object(
        'success', true,
        'order_id', v_order_id,
        'order_number', v_order_number,
        'total_amount', v_total_amount,
        'pickup_otp', v_pickup_otp,
        'pickup_location_id', v_location_record.id,
        'pickup_location_name', v_location_record.name
    );
EXCEPTION
    WHEN OTHERS THEN
        RAISE EXCEPTION '%', SQLERRM;
END;
$$;

GRANT EXECUTE ON FUNCTION public.create_student_order(JSONB, UUID) TO authenticated;

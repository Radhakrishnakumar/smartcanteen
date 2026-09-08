-- =======================================================
-- SMART CANTEEN - MIGRATION 006: ORDERS & CHECKOUT SYSTEM
-- File: database/migrations/006_orders.sql
-- =======================================================

-- 1. Create orders table if not exists
CREATE TABLE IF NOT EXISTS public.orders (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    order_number SERIAL UNIQUE,
    student_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    total_amount NUMERIC(10, 2) NOT NULL CHECK (total_amount >= 0),
    status TEXT NOT NULL DEFAULT 'placed' CHECK (status IN ('placed', 'preparing', 'ready', 'completed', 'cancelled')),
    pickup_method TEXT NOT NULL DEFAULT 'Canteen Pickup',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 2. Create order_items table if not exists
CREATE TABLE IF NOT EXISTS public.order_items (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    order_id UUID NOT NULL REFERENCES public.orders(id) ON DELETE CASCADE,
    menu_item_id UUID, -- Nullable to preserve history if menu_item is physically deleted later
    item_name TEXT NOT NULL,
    unit_price NUMERIC(10, 2) NOT NULL CHECK (unit_price >= 0),
    quantity INTEGER NOT NULL CHECK (quantity > 0),
    line_total NUMERIC(10, 2) NOT NULL CHECK (line_total >= 0),
    image_url TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 3. Create Performance Indices
CREATE INDEX IF NOT EXISTS idx_orders_student ON public.orders(student_id);
CREATE INDEX IF NOT EXISTS idx_orders_status ON public.orders(status);
CREATE INDEX IF NOT EXISTS idx_order_items_order ON public.order_items(order_id);

-- 4. Enable Row Level Security (RLS)
ALTER TABLE public.orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.order_items ENABLE ROW LEVEL SECURITY;

-- -------------------------------------------------------
-- RLS POLICIES FOR ORDERS
-- -------------------------------------------------------
DROP POLICY IF EXISTS "Students can view own orders" ON public.orders;
CREATE POLICY "Students can view own orders"
ON public.orders FOR SELECT
USING (auth.uid() = student_id);

DROP POLICY IF EXISTS "Students can create own orders" ON public.orders;
CREATE POLICY "Students can create own orders"
ON public.orders FOR INSERT
WITH CHECK (auth.uid() = student_id);

DROP POLICY IF EXISTS "Workers can view all orders" ON public.orders;
CREATE POLICY "Workers can view all orders"
ON public.orders FOR SELECT
USING (
    EXISTS (
        SELECT 1 FROM public.profiles
        WHERE user_id = auth.uid() AND role = 'worker'
    )
);

DROP POLICY IF EXISTS "Workers can update order status" ON public.orders;
CREATE POLICY "Workers can update order status"
ON public.orders FOR UPDATE
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

-- -------------------------------------------------------
-- RLS POLICIES FOR ORDER_ITEMS
-- -------------------------------------------------------
DROP POLICY IF EXISTS "Students and workers can view order items" ON public.order_items;
CREATE POLICY "Students and workers can view order items"
ON public.order_items FOR SELECT
USING (
    EXISTS (
        SELECT 1 FROM public.orders
        WHERE id = order_items.order_id AND (
            orders.student_id = auth.uid() OR
            EXISTS (
                SELECT 1 FROM public.profiles
                WHERE user_id = auth.uid() AND role = 'worker'
            )
        )
    )
);

DROP POLICY IF EXISTS "Students can create order items for own order" ON public.order_items;
CREATE POLICY "Students can create order items for own order"
ON public.order_items FOR INSERT
WITH CHECK (
    EXISTS (
        SELECT 1 FROM public.orders
        WHERE id = order_items.order_id AND orders.student_id = auth.uid()
    )
);

-- -------------------------------------------------------
-- 5. ATOMIC STORED PROCEDURE FOR SECURE ORDER CREATION
-- Server-side price calculation & total verification
-- -------------------------------------------------------
CREATE OR REPLACE FUNCTION public.create_student_order(
    p_cart_items JSONB
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
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
BEGIN
    -- 1. Verify user authentication
    v_student_id := auth.uid();
    IF v_student_id IS NULL THEN
        RAISE EXCEPTION 'Unauthorized: User must be authenticated to place an order.';
    END IF;

    -- 2. Validate input array
    IF p_cart_items IS NULL OR jsonb_array_length(p_cart_items) = 0 THEN
        RAISE EXCEPTION 'Cart is empty. Please add items to your cart before placing an order.';
    END IF;

    -- 3. Calculate authoritative total & verify stock/active status for all items
    FOR v_item IN SELECT * FROM jsonb_array_elements(p_cart_items)
    LOOP
        v_menu_item_id := (v_item->>'menu_item_id')::UUID;
        v_qty := (v_item->>'quantity')::INT;

        IF v_qty IS NULL OR v_qty <= 0 THEN
            RAISE EXCEPTION 'Invalid item quantity specified.';
        END IF;

        -- Fetch menu item from database
        SELECT id, name, price, is_available, is_active, image_url
        INTO v_menu_record
        FROM public.menu_items
        WHERE id = v_menu_item_id;

        IF NOT FOUND THEN
            RAISE EXCEPTION 'One or more items in your cart no longer exist in the menu database.';
        END IF;

        IF v_menu_record.is_active IS FALSE THEN
            RAISE EXCEPTION 'Item "%" has been removed from the canteen menu by kitchen staff.', v_menu_record.name;
        END IF;

        IF v_menu_record.is_available IS FALSE THEN
            RAISE EXCEPTION 'Item "%" is currently Out of Stock.', v_menu_record.name;
        END IF;

        v_line_total := v_menu_record.price * v_qty;
        v_total_amount := v_total_amount + v_line_total;
    END LOOP;

    -- 4. Create Order Header Record
    INSERT INTO public.orders (
        student_id,
        total_amount,
        status,
        pickup_method
    ) VALUES (
        v_student_id,
        v_total_amount,
        'placed',
        'Canteen Pickup'
    )
    RETURNING id, order_number INTO v_order_id, v_order_number;

    -- 5. Create Order Item Snapshot Records
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

    -- 6. Return success response
    RETURN jsonb_build_object(
        'success', true,
        'order_id', v_order_id,
        'order_number', v_order_number,
        'total_amount', v_total_amount
    );
EXCEPTION
    WHEN OTHERS THEN
        RAISE EXCEPTION '%', SQLERRM;
END;
$$;

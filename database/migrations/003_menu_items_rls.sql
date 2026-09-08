-- =======================================================
-- SMART CANTEEN - MILESTONE 2 MIGRATION: MENU ITEMS & RLS
-- File: database/migrations/003_menu_items_rls.sql
-- =======================================================

-- 1. Ensure UUID Extension is available
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 2. Create FOOD CATEGORIES Table if not exists
CREATE TABLE IF NOT EXISTS public.categories (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name TEXT NOT NULL UNIQUE,
    slug TEXT NOT NULL UNIQUE,
    description TEXT,
    display_order INT DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 3. Create MENU ITEMS Table if not exists
CREATE TABLE IF NOT EXISTS public.menu_items (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    category_id UUID REFERENCES public.categories(id) ON DELETE SET NULL,
    name TEXT NOT NULL,
    description TEXT,
    price NUMERIC(10, 2) NOT NULL CHECK (price >= 0),
    is_available BOOLEAN DEFAULT true,
    image_url TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Add Indexing for Performance
CREATE INDEX IF NOT EXISTS idx_menu_items_category ON public.menu_items(category_id);

-- 4. Enable Row Level Security (RLS) on categories and menu_items tables
ALTER TABLE public.categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.menu_items ENABLE ROW LEVEL SECURITY;

-- 5. Drop existing policies if any
DROP POLICY IF EXISTS "Categories read policy" ON public.categories;
DROP POLICY IF EXISTS "Categories worker insert policy" ON public.categories;
DROP POLICY IF EXISTS "Categories worker update policy" ON public.categories;
DROP POLICY IF EXISTS "Menu items read policy" ON public.menu_items;
DROP POLICY IF EXISTS "Menu items worker insert policy" ON public.menu_items;
DROP POLICY IF EXISTS "Menu items worker update policy" ON public.menu_items;
DROP POLICY IF EXISTS "Menu items worker delete policy" ON public.menu_items;

-- 6. SELECT Policies (Allow all authenticated & anonymous users to read menu items and categories)
CREATE POLICY "Categories read policy" 
ON public.categories 
FOR SELECT 
USING (true);

CREATE POLICY "Menu items read policy" 
ON public.menu_items 
FOR SELECT 
USING (true);

-- 7. INSERT/UPDATE/DELETE Policies (Restricted strictly to authenticated workers)
CREATE POLICY "Categories worker insert policy" 
ON public.categories 
FOR INSERT 
WITH CHECK (
    EXISTS (
        SELECT 1 FROM public.profiles 
        WHERE user_id = auth.uid() AND role = 'worker'
    )
);

CREATE POLICY "Categories worker update policy" 
ON public.categories 
FOR UPDATE 
USING (
    EXISTS (
        SELECT 1 FROM public.profiles 
        WHERE user_id = auth.uid() AND role = 'worker'
    )
);

CREATE POLICY "Menu items worker insert policy" 
ON public.menu_items 
FOR INSERT 
WITH CHECK (
    EXISTS (
        SELECT 1 FROM public.profiles 
        WHERE user_id = auth.uid() AND role = 'worker'
    )
);

CREATE POLICY "Menu items worker update policy" 
ON public.menu_items 
FOR UPDATE 
USING (
    EXISTS (
        SELECT 1 FROM public.profiles 
        WHERE user_id = auth.uid() AND role = 'worker'
    )
);

CREATE POLICY "Menu items worker delete policy" 
ON public.menu_items 
FOR DELETE 
USING (
    EXISTS (
        SELECT 1 FROM public.profiles 
        WHERE user_id = auth.uid() AND role = 'worker'
    )
);

-- 8. Seed default categories if missing
INSERT INTO public.categories (name, slug, description, display_order)
VALUES 
    ('Breakfast', 'breakfast', 'Morning breakfast items & south indian snacks', 1),
    ('Meals', 'meals', 'Lunch & dinner combo meals', 2),
    ('Snacks', 'snacks', 'Quick bites and grilled sandwiches', 3),
    ('Beverages', 'beverages', 'Hot & cold drinks', 4)
ON CONFLICT (name) DO NOTHING;

-- 9. Seed initial menu items if missing
INSERT INTO public.menu_items (name, category_id, price, description, is_available, image_url)
SELECT 
    'Masala Dosa', id, 60.00, 'Crispy rice crepes served with potato masala, sambar & fresh coconut chutney.', true, '/images/masala_dosa.png'
FROM public.categories WHERE name = 'Breakfast'
AND NOT EXISTS (SELECT 1 FROM public.menu_items WHERE name = 'Masala Dosa');

INSERT INTO public.menu_items (name, category_id, price, description, is_available, image_url)
SELECT 
    'Paneer Butter Masala Combo', id, 130.00, 'Rich creamy paneer curry served with 2 butter naans and fragrant basmati rice.', true, '/images/paneer_butter_masala.png'
FROM public.categories WHERE name = 'Meals'
AND NOT EXISTS (SELECT 1 FROM public.menu_items WHERE name = 'Paneer Butter Masala Combo');

INSERT INTO public.menu_items (name, category_id, price, description, is_available, image_url)
SELECT 
    'Cold Coffee with Ice Cream', id, 50.00, 'Chilled espresso blended with thick milk, topped with a scoop of vanilla ice cream.', true, '/images/cold_coffee.png'
FROM public.categories WHERE name = 'Beverages'
AND NOT EXISTS (SELECT 1 FROM public.menu_items WHERE name = 'Cold Coffee with Ice Cream');

INSERT INTO public.menu_items (name, category_id, price, description, is_available, image_url)
SELECT 
    'Veg Cheese Grill Sandwich', id, 75.00, 'Triple-layered toasted sandwich loaded with fresh veggies, green chutney and melted cheese.', true, '/images/veg_cheese_sandwich.png'
FROM public.categories WHERE name = 'Snacks'
AND NOT EXISTS (SELECT 1 FROM public.menu_items WHERE name = 'Veg Cheese Grill Sandwich');

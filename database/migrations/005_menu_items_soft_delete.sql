-- =======================================================
-- SMART CANTEEN - MIGRATION 005: SOFT DELETE & RLS FIX
-- File: database/migrations/005_menu_items_soft_delete.sql
-- Add is_active column & Update RLS UPDATE policy with USING and WITH CHECK
-- =======================================================

-- 1. Add is_active column to public.menu_items if missing
ALTER TABLE public.menu_items
ADD COLUMN IF NOT EXISTS is_active BOOLEAN NOT NULL DEFAULT true;

-- 2. Create performance index for is_active queries
CREATE INDEX IF NOT EXISTS idx_menu_items_is_active ON public.menu_items(is_active);

-- 3. Replace RLS UPDATE policy on menu_items to include BOTH USING and WITH CHECK
DROP POLICY IF EXISTS "Menu items worker update policy" ON public.menu_items;

CREATE POLICY "Menu items worker update policy" 
ON public.menu_items 
FOR UPDATE 
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

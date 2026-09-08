-- =======================================================
-- SMART CANTEEN - MILESTONE 2 MIGRATION 004
-- File: database/migrations/004_food_images_and_storage.sql
-- Production-Safe Supabase Storage Bucket, RLS Policies & Samosa Chaat Seed
-- =======================================================

-- 1. Create Supabase Storage bucket for menu-items if storage extension active
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
    'menu-items',
    'menu-items',
    true,
    5242880, -- 5MB file size limit
    ARRAY['image/jpeg', 'image/jpg', 'image/png', 'image/webp']
)
ON CONFLICT (id) DO UPDATE SET public = true;

-- 2. Storage Row Level Security (RLS) Policies on storage.objects
DO $$
BEGIN
  -- Enable RLS on storage.objects if available
  IF EXISTS (SELECT 1 FROM pg_tables WHERE schemaname = 'storage' AND tablename = 'objects') THEN
    EXECUTE 'ALTER TABLE storage.objects ENABLE ROW LEVEL SECURITY';

    -- Drop existing policies if any to prevent duplicates
    EXECUTE 'DROP POLICY IF EXISTS "Public read access for menu items storage" ON storage.objects';
    EXECUTE 'DROP POLICY IF EXISTS "Worker insert policy for menu items storage" ON storage.objects';
    EXECUTE 'DROP POLICY IF EXISTS "Worker update policy for menu items storage" ON storage.objects';
    EXECUTE 'DROP POLICY IF EXISTS "Worker delete policy for menu items storage" ON storage.objects';

    -- SELECT Policy: Public read access for menu items storage bucket
    EXECUTE 'CREATE POLICY "Public read access for menu items storage" ON storage.objects FOR SELECT USING (bucket_id = ''menu-items'')';

    -- INSERT Policy: Restricted strictly to authenticated workers
    EXECUTE 'CREATE POLICY "Worker insert policy for menu items storage" ON storage.objects FOR INSERT WITH CHECK (bucket_id = ''menu-items'' AND EXISTS (SELECT 1 FROM public.profiles WHERE user_id = auth.uid() AND role = ''worker''))';

    -- UPDATE Policy: Restricted strictly to authenticated workers
    EXECUTE 'CREATE POLICY "Worker update policy for menu items storage" ON storage.objects FOR UPDATE USING (bucket_id = ''menu-items'' AND EXISTS (SELECT 1 FROM public.profiles WHERE user_id = auth.uid() AND role = ''worker''))';

    -- DELETE Policy: Restricted strictly to authenticated workers
    EXECUTE 'CREATE POLICY "Worker delete policy for menu items storage" ON storage.objects FOR DELETE USING (bucket_id = ''menu-items'' AND EXISTS (SELECT 1 FROM public.profiles WHERE user_id = auth.uid() AND role = ''worker''))';
  END IF;
EXCEPTION
  WHEN OTHERS THEN NULL;
END $$;

-- 3. Update existing 'samosa chat' / 'Samosa Chaat' record in menu_items table
UPDATE public.menu_items
SET 
    name = 'Samosa Chaat',
    image_url = '/images/samosa_chaat.png',
    description = 'Crispy samosa crushed and topped with warm chickpea curry, sweet yogurt, tangy tamarind chutney, and fresh coriander.',
    price = 50.00,
    updated_at = NOW()
WHERE LOWER(name) IN ('samosa chat', 'samosa chaat');

-- 4. Seed Samosa Chaat if not already present in menu_items
INSERT INTO public.menu_items (name, category_id, price, description, is_available, image_url)
SELECT 
    'Samosa Chaat', id, 50.00, 'Crispy samosa crushed and topped with warm chickpea curry, sweet yogurt, tangy tamarind chutney, and fresh coriander.', true, '/images/samosa_chaat.png'
FROM public.categories WHERE LOWER(name) IN ('snacks', 'breakfast')
LIMIT 1
ON CONFLICT DO NOTHING;

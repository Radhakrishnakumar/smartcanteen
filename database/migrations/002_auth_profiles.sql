-- =======================================================
-- SMART CANTEEN - MILESTONE 1 MIGRATION: AUTH & PROFILES
-- File: database/migrations/002_auth_profiles.sql
-- =======================================================

-- 1. Ensure public.profiles table schema is up to date
CREATE TABLE IF NOT EXISTS public.profiles (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID UNIQUE NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    full_name TEXT NOT NULL,
    email TEXT UNIQUE NOT NULL,
    role TEXT NOT NULL DEFAULT 'student' CHECK (role IN ('student', 'worker', 'admin')),
    phone_number TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 2. Trigger Function: Automatically create profile on new user signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
    INSERT INTO public.profiles (id, user_id, full_name, email, role)
    VALUES (
        new.id,
        new.id,
        COALESCE(new.raw_user_meta_data->>'full_name', 'Student User'),
        new.email,
        'student' -- Normal public signup ALWAYS defaults to student
    )
    ON CONFLICT (user_id) DO UPDATE
    SET full_name = EXCLUDED.full_name,
        email = EXCLUDED.email,
        updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Bind trigger to auth.users table
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
    AFTER INSERT ON auth.users
    FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- 3. Row Level Security (RLS) Policies on public.profiles
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- Policy: Users and workers can view profiles (USING true avoids RLS infinite recursion)
DROP POLICY IF EXISTS "Profiles read policy" ON public.profiles;
CREATE POLICY "Profiles read policy" 
ON public.profiles 
FOR SELECT 
USING (true);

-- Policy: Users can update their own profile, BUT cannot change their role
DROP POLICY IF EXISTS "Profiles update policy" ON public.profiles;
CREATE POLICY "Profiles update policy" 
ON public.profiles 
FOR UPDATE 
USING (auth.uid() = user_id)
WITH CHECK (
    auth.uid() = user_id 
    AND role = (SELECT role FROM public.profiles WHERE user_id = auth.uid())
);

-- 4. Clean up RPC function & Controlled Worker Promotion via SQL Editor
DROP FUNCTION IF EXISTS public.promote_user_to_worker(TEXT, TEXT);

-- DEVELOPER INSTRUCTION:
-- To promote an existing registered user account to worker during development,
-- run the following command directly in the Supabase Dashboard SQL Editor:
--
-- UPDATE public.profiles SET role = 'worker' WHERE email = 'worker_email_here@domain.com';


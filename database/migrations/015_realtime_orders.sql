-- =======================================================
-- SMART CANTEEN - MIGRATION 015: SUPABASE REALTIME FOR ORDERS
-- File: database/migrations/015_realtime_orders.sql
-- =======================================================

-- Enable Supabase Realtime (Postgres Changes) publication for public.orders table
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_publication_tables 
        WHERE pubname = 'supabase_realtime' AND tablename = 'orders'
    ) THEN
        ALTER PUBLICATION supabase_realtime ADD TABLE public.orders;
    END IF;
END $$;

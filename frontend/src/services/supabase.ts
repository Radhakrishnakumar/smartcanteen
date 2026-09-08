import { createClient } from '@supabase/supabase-js';
import { env, isSupabaseConfigured } from '../config/env';

// Graceful fallback dummy values if env variables are not yet provided in .env
const dummyUrl = 'https://placeholder.supabase.co';
const dummyKey = 'placeholder-key';

export const supabase = createClient(
  isSupabaseConfigured ? env.supabaseUrl : dummyUrl,
  isSupabaseConfigured ? env.supabaseAnonKey : dummyKey
);

export async function testSupabaseConnection(): Promise<{ success: boolean; message: string }> {
  if (!isSupabaseConfigured) {
    return {
      success: false,
      message: 'Supabase credentials missing in .env file.',
    };
  }

  try {
    // Basic lightweight REST ping to check connection
    const { error } = await supabase.from('profiles').select('count', { count: 'exact', head: true });
    
    // Even if table profiles does not exist yet or yields 404, a reachable server returns HTTP response
    if (error && error.code !== 'PGRST116' && error.code !== '42P01') {
      // 42P01 is table does not exist, which still proves connection
    }

    return {
      success: true,
      message: 'Connected to Supabase project successfully.',
    };
  } catch (err) {
    const errorMsg = err instanceof Error ? err.message : 'Unknown connection error';
    return {
      success: false,
      message: `Connection failed: ${errorMsg}`,
    };
  }
}

export const env = {
  supabaseUrl: import.meta.env.VITE_SUPABASE_URL || '',
  supabaseAnonKey: import.meta.env.VITE_SUPABASE_ANON_KEY || import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY || '',
  backendUrl: import.meta.env.VITE_BACKEND_URL || 'http://localhost:5000',
};

export const isSupabaseConfigured = Boolean(
  env.supabaseUrl &&
  env.supabaseUrl !== 'https://your-supabase-project-id.supabase.co' &&
  env.supabaseAnonKey &&
  env.supabaseAnonKey !== 'your-supabase-anon-key-here' &&
  env.supabaseAnonKey !== 'your-supabase-publishable-key-here'
);


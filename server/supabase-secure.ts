import { createClient } from '@supabase/supabase-js';

// Configuración segura para Supabase con manejo de certificados
export function createSecureSupabaseClient() {
  const supabaseUrl = process.env.SUPABASE_URL || 
                      process.env.NEXT_PUBLIC_SUPABASE_URL || 
                      process.env.VITE_SUPABASE_URL || '';
  
  const supabaseKey = process.env.SUPABASE_ANON_KEY || 
                       process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 
                       process.env.VITE_SUPABASE_ANON_KEY || '';

  if (!supabaseUrl || !supabaseKey) {
    throw new Error('Supabase configuration is missing. Please check your environment variables.');
  }

  // Configuración optimizada para Vercel + Supabase
  const options = {
    auth: {
      autoRefreshToken: false, // Desactivado para server-side
      persistSession: false,   // No persistir en server
      detectSessionInUrl: false
    },
    global: {
      headers: {
        'User-Agent': 'calendario-server/1.0.0'
      }
    }
  };

  return createClient(supabaseUrl, supabaseKey, options);
}

export const supabase = createSecureSupabaseClient();

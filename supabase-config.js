// Supabase configuration for deployment
export const supabaseConfig = {
  // Replace with your Supabase project URL
  url: process.env.SUPABASE_URL,
  
  // Replace with your Supabase anon key
  anonKey: process.env.SUPABASE_ANON_KEY,
};

// For client-side usage (only anon key)
export const supabaseClient = {
  url: supabaseConfig.url,
  anonKey: supabaseConfig.anonKey
};


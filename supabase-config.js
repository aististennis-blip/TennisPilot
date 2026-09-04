const SUPABASE_URL = "https://frhvwgmmpugeuhysrvms.supabase.co";

const SUPABASE_PUBLISHABLE_KEY =
  "sb_publishable_9qx_stNnG48jRPIUPUva3Q_6w3MSDGx";

const tennisPilotSupabase =
  window.supabase.createClient(
    SUPABASE_URL,
    SUPABASE_PUBLISHABLE_KEY,
    {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: true
      }
    }
  );

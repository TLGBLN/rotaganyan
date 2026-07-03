import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
// Service role key varsa onu, yoksa anon key kullan.
// Bucket'a RLS politikası eklendiği için anon key de yeterli.
// Gerçek güvenlik katmanı /api/admin/upload-banner route'unda ADMIN kontrolüdür.
const key =
  process.env.SUPABASE_SERVICE_ROLE_KEY ||
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

export const supabaseAdmin = createClient(supabaseUrl, key, {
  auth: { persistSession: false },
});

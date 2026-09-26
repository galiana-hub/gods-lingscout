// ⚠️ IMPORTANTE: rellena estos dos valores con los de TU proyecto de Supabase.
// Los encuentras en: Supabase → tu proyecto → Settings (icono engranaje) → API
//   - "Project URL"      → pégalo en SUPABASE_URL
//   - "anon public" key  → pégalo en SUPABASE_ANON_KEY
// Esta clave "anon" es pública y segura de exponer aquí; la seguridad real
// de los datos la da la RLS (Row Level Security) activada en Supabase.

const SUPABASE_URL = "https://gttxndiiqghpclycancw.supabase.co";
const SUPABASE_ANON_KEY = "sb_publishable_j8JiwNV2vN83KQIo5Mh38w_sRBGsjum";

const supabaseClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

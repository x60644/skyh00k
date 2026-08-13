import { createClient } from '@supabase/supabase-js'

const url = import.meta.env.VITE_SUPABASE_URL
const key = import.meta.env.VITE_SUPABASE_ANON_KEY

// Null when env vars aren't configured — the app degrades gracefully.
export const supa = url && key ? createClient(url, key) : null

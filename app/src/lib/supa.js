import { createClient } from '@supabase/supabase-js'

const url = import.meta.env.VITE_SUPABASE_URL
const key = import.meta.env.VITE_SUPABASE_ANON_KEY

let client = null
try {
  if (url && key && url.startsWith('https://')) {
    client = createClient(url, key)
  }
} catch (e) {
  console.warn('Supabase disabled:', e.message)
}

export const supa = client

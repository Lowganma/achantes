let cachedClient = null
let tried = false

export const getSupabaseClient = async () => {
  if (cachedClient) return cachedClient
  if (tried) return null
  tried = true

  const url = import.meta.env.VITE_SUPABASE_URL
  const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY
  if (!url || !anonKey) return null

  try {
    const mod = await import(/* @vite-ignore */ 'https://esm.sh/@supabase/supabase-js@2')
    cachedClient = mod.createClient(url, anonKey, {
      auth: { persistSession: false },
      realtime: { params: { eventsPerSecond: 10 } },
    })
    return cachedClient
  } catch {
    return null
  }
}

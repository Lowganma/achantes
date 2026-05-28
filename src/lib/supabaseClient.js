import { createClient } from '@supabase/supabase-js'

let cachedClient = null
let tried = false

export const getSupabaseClient = async () => {
  const url = import.meta.env.VITE_SUPABASE_URL
  const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

  console.log('Supabase env:', {
    hasUrl: Boolean(url),
    hasKey: Boolean(anonKey),
  })

  if (cachedClient) {
    console.log('Supabase client: usando cliente en cache')
    return cachedClient
  }

  if (tried) {
    console.warn('Supabase client: ya se intentó crear y falló antes')
    return null
  }

  tried = true

  if (!url || !anonKey) {
    console.warn('Supabase client: faltan variables de entorno')
    return null
  }

  try {
    cachedClient = createClient(url, anonKey, {
      auth: {
        persistSession: false,
      },
      realtime: {
        params: {
          eventsPerSecond: 10,
        },
      },
    })

    console.log('Supabase client: creado correctamente')
    return cachedClient
  } catch (error) {
    console.error('Supabase client: error creando cliente', error)
    return null
  }
}
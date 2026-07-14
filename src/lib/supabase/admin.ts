import { createClient } from '@supabase/supabase-js'

// Cliente com a service role key: ignora RLS e dá acesso à Admin API de
// autenticação (criar usuário, redefinir senha). Só pode ser usado em
// server actions, nunca exposto ao navegador.
export function createAdminClient() {
  return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SECRET_KEY!, {
    auth: { autoRefreshToken: false, persistSession: false },
  })
}

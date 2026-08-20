import { type NextRequest } from 'next/server'
import { updateSession } from '@/lib/supabase/middleware'

export async function proxy(request: NextRequest) {
  return await updateSession(request)
}

export const config = {
  // /api/* fica de fora: o cron da Vercel e qualquer chamada sem cookie de
  // sessão (curl, o próprio cron) caía sempre no redirect pra /login antes
  // de a rota rodar — e cada rota de /api já confere autenticação por conta
  // própria (auth.getUser() ou CRON_SECRET), então o redirect aqui só
  // atrapalhava. Descoberto ao testar o CRON_SECRET recém-configurado.
  matcher: [
    '/((?!api/|_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
}

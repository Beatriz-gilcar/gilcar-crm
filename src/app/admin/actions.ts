'use server'

import { redirect } from 'next/navigation'
import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'

async function requireAdmin() {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) redirect('/login')

  const { data: profile } = await supabase
    .from('profiles')
    .select('cargo')
    .eq('id', user.id)
    .single<{ cargo: string }>()

  if (profile?.cargo !== 'admin') redirect('/')

  return supabase
}

export async function createMembro(formData: FormData) {
  const supabase = await requireAdmin()

  const nome = (formData.get('nome') as string)?.trim()
  const email = (formData.get('email') as string)?.trim().toLowerCase()
  const senha = formData.get('senha') as string
  const cargo = formData.get('cargo') as string
  const unidadeRaw = formData.get('unidade_id') as string
  const unidade_id = unidadeRaw || null

  if (!nome || !email || !senha || !cargo || (cargo !== 'admin' && !unidade_id)) {
    redirect(`/admin/new?error=${encodeURIComponent('Preencha nome, e-mail, senha, cargo e unidade')}`)
  }

  if (senha.length < 8) {
    redirect(`/admin/new?error=${encodeURIComponent('A senha precisa ter pelo menos 8 caracteres')}`)
  }

  const adminClient = createAdminClient()

  const { data: created, error: createError } = await adminClient.auth.admin.createUser({
    email,
    password: senha,
    email_confirm: true,
    user_metadata: { nome },
  })

  if (createError || !created.user) {
    const message = createError?.message.includes('already been registered')
      ? 'Já existe um usuário com esse e-mail'
      : 'Não foi possível criar o login'
    redirect(`/admin/new?error=${encodeURIComponent(message)}`)
  }

  const { error: profileError } = await supabase
    .from('profiles')
    .update({ nome, cargo, unidade_id })
    .eq('id', created.user!.id)

  if (profileError) {
    redirect(`/admin/new?error=${encodeURIComponent('Login criado, mas não foi possível salvar cargo/unidade')}`)
  }

  revalidatePath('/admin')
  redirect('/admin')
}

export async function updateMembro(formData: FormData) {
  const supabase = await requireAdmin()

  const id = formData.get('id') as string
  const nome = (formData.get('nome') as string)?.trim()
  const cargo = formData.get('cargo') as string
  const unidadeRaw = formData.get('unidade_id') as string
  const unidade_id = unidadeRaw || null

  if (!nome || !cargo || (cargo !== 'admin' && !unidade_id)) {
    redirect(`/admin/${id}?error=${encodeURIComponent('Preencha nome, cargo e unidade')}`)
  }

  const { error } = await supabase.from('profiles').update({ nome, cargo, unidade_id }).eq('id', id)

  if (error) {
    redirect(`/admin/${id}?error=${encodeURIComponent('Não foi possível salvar o membro')}`)
  }

  revalidatePath('/admin')
  redirect(`/admin/${id}?success=1`)
}

export async function resetSenha(formData: FormData) {
  await requireAdmin()

  const id = formData.get('id') as string
  const novaSenha = formData.get('nova_senha') as string

  if (!novaSenha || novaSenha.length < 8) {
    redirect(`/admin/${id}?error=${encodeURIComponent('A nova senha precisa ter pelo menos 8 caracteres')}`)
  }

  const adminClient = createAdminClient()
  const { error } = await adminClient.auth.admin.updateUserById(id, { password: novaSenha })

  if (error) {
    redirect(`/admin/${id}?error=${encodeURIComponent('Não foi possível redefinir a senha')}`)
  }

  redirect(`/admin/${id}?success=senha`)
}

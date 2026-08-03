'use server'

import { redirect } from 'next/navigation'
import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { podeFicarSemUnidade } from '@/lib/membros'
import { normalizarTelefone } from '@/lib/whatsapp'

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
  const gerente_responsavel = (formData.get('gerente_responsavel') as string)?.trim() || null
  const telefoneRaw = (formData.get('telefone') as string)?.trim()
  const telefone = telefoneRaw ? normalizarTelefone(telefoneRaw) : null

  if (!nome || !email || !senha || !cargo) {
    redirect(`/admin/new?error=${encodeURIComponent('Preencha nome, e-mail, senha e cargo')}`)
  }

  // Recusa número torto na entrada: o check do banco rejeitaria depois, e a
  // Meta descartaria a mensagem em silêncio — pior ainda.
  if (telefoneRaw && !telefone) {
    redirect(`/admin/new?error=${encodeURIComponent('Telefone inválido — use DDD + número, ex: (21) 99999-8888')}`)
  }

  // Admin e Visualizador são cargos de rede inteira: o acesso deles não passa
  // por unidade (is_gerencia() / is_visualizador() ignoram o campo), então
  // "Todas" é legítimo. Consultor, Supervisor e Gerente precisam de unidade —
  // é ela que define o escopo deles, e a Ficha não grava sem.
  if (!podeFicarSemUnidade(cargo) && !unidade_id) {
    redirect(`/admin/new?error=${encodeURIComponent('Unidade "Todas" é só para Admin e Visualizador — escolha uma unidade')}`)
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
    .update({ nome, cargo, unidade_id, gerente_responsavel, telefone })
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
  const gerente_responsavel = (formData.get('gerente_responsavel') as string)?.trim() || null
  const telefoneRaw = (formData.get('telefone') as string)?.trim()
  const telefone = telefoneRaw ? normalizarTelefone(telefoneRaw) : null

  if (!nome || !cargo) {
    redirect(`/admin/${id}?error=${encodeURIComponent('Preencha nome e cargo')}`)
  }

  if (telefoneRaw && !telefone) {
    redirect(`/admin/${id}?error=${encodeURIComponent('Telefone inválido — use DDD + número, ex: (21) 99999-8888')}`)
  }

  // Admin e Visualizador são cargos de rede inteira: o acesso deles não passa
  // por unidade (is_gerencia() / is_visualizador() ignoram o campo), então
  // "Todas" é legítimo. Consultor, Supervisor e Gerente precisam de unidade —
  // é ela que define o escopo deles, e a Ficha não grava sem.
  if (!podeFicarSemUnidade(cargo) && !unidade_id) {
    redirect(`/admin/${id}?error=${encodeURIComponent('Unidade "Todas" é só para Admin e Visualizador — escolha uma unidade')}`)
  }

  const { error } = await supabase
    .from('profiles')
    .update({ nome, cargo, unidade_id, gerente_responsavel, telefone })
    .eq('id', id)

  if (error) {
    redirect(`/admin/${id}?error=${encodeURIComponent('Não foi possível salvar o membro')}`)
  }

  revalidatePath('/admin')
  redirect(`/admin/${id}?success=1`)
}

// Desativar em vez de excluir: profiles é referenciada por vários FKs sem
// cascade, então apagar de verdade ou falha ou levaria junto o histórico de
// fichas, ordens e metas do membro. O ban no Auth corta o login; o `ativo` tira
// ele da listagem. Os registros antigos continuam apontando pro perfil.
export async function alternarAtivoMembro(formData: FormData) {
  const supabase = await requireAdmin()

  const id = formData.get('id') as string
  const desativar = formData.get('ativo') === 'true'

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (desativar && user?.id === id) {
    redirect(`/admin?error=${encodeURIComponent('Você não pode desativar o próprio acesso')}`)
  }

  const { error } = await supabase.from('profiles').update({ ativo: !desativar }).eq('id', id)

  if (error) {
    redirect(`/admin?error=${encodeURIComponent('Não foi possível alterar a situação do membro')}`)
  }

  const adminClient = createAdminClient()
  const { error: authError } = await adminClient.auth.admin.updateUserById(id, {
    ban_duration: desativar ? '876000h' : 'none',
  })

  if (authError) {
    // O perfil já mudou; sem o ban o login continuaria de pé, então desfaz.
    await supabase.from('profiles').update({ ativo: desativar }).eq('id', id)
    redirect(`/admin?error=${encodeURIComponent('Não foi possível alterar o login do membro')}`)
  }

  revalidatePath('/admin')
  redirect('/admin')
}

export async function alterarEmail(formData: FormData) {
  await requireAdmin()

  const id = formData.get('id') as string
  const email = (formData.get('email') as string)?.trim().toLowerCase()

  if (!email) {
    redirect(`/admin/${id}?error=${encodeURIComponent('Informe o e-mail')}`)
  }

  const adminClient = createAdminClient()
  const { error } = await adminClient.auth.admin.updateUserById(id, { email, email_confirm: true })

  if (error) {
    const message = error.message.includes('already been registered')
      ? 'Já existe um usuário com esse e-mail'
      : 'Não foi possível alterar o e-mail'
    redirect(`/admin/${id}?error=${encodeURIComponent(message)}`)
  }

  redirect(`/admin/${id}?success=email`)
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

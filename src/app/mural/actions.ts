'use server'

import { redirect } from 'next/navigation'
import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'

function text(formData: FormData, key: string): string {
  return ((formData.get(key) as string) ?? '').trim()
}

export async function criarPost(formData: FormData) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const tipo = formData.get('tipo') === 'sugestao' ? 'sugestao' : 'duvida'
  const titulo = text(formData, 'titulo')
  const conteudo = text(formData, 'conteudo')

  if (!titulo || !conteudo) {
    redirect(`/mural?error=${encodeURIComponent('Preencha o título e a descrição')}`)
  }

  const { error } = await supabase.from('mural_posts').insert({ autor_id: user.id, tipo, titulo, conteudo })

  if (error) {
    redirect(`/mural?error=${encodeURIComponent('Não foi possível publicar')}`)
  }

  revalidatePath('/mural')
  redirect('/mural?success=1')
}

export async function criarResposta(formData: FormData) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const post_id = formData.get('post_id') as string
  const conteudo = text(formData, 'conteudo')

  if (!post_id || !conteudo) {
    redirect('/mural')
  }

  const { error } = await supabase.from('mural_respostas').insert({ post_id, autor_id: user.id, conteudo })

  if (error) {
    redirect(`/mural?error=${encodeURIComponent('Não foi possível responder')}`)
  }

  revalidatePath('/mural')
  redirect('/mural')
}

export async function excluirPost(formData: FormData) {
  const supabase = await createClient()
  const id = formData.get('id') as string

  const { error } = await supabase.from('mural_posts').delete().eq('id', id)

  if (error) {
    redirect(`/mural?error=${encodeURIComponent('Não foi possível excluir')}`)
  }

  revalidatePath('/mural')
  redirect('/mural')
}

export async function excluirResposta(formData: FormData) {
  const supabase = await createClient()
  const id = formData.get('id') as string

  const { error } = await supabase.from('mural_respostas').delete().eq('id', id)

  if (error) {
    redirect(`/mural?error=${encodeURIComponent('Não foi possível excluir')}`)
  }

  revalidatePath('/mural')
  redirect('/mural')
}

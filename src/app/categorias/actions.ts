'use server'

import { redirect } from 'next/navigation'
import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'

export async function createCategoria(formData: FormData) {
  const supabase = await createClient()

  const nome = (formData.get('nome') as string)?.trim()
  const cor = (formData.get('cor') as string)?.trim() || null

  if (!nome) {
    redirect(`/categorias?error=${encodeURIComponent('Informe o nome da categoria')}`)
  }

  const { error } = await supabase.from('categorias').insert({ nome, cor })

  if (error) {
    redirect(`/categorias?error=${encodeURIComponent('Não foi possível salvar a categoria')}`)
  }

  revalidatePath('/categorias')
  redirect('/categorias')
}

export async function deleteCategoria(formData: FormData) {
  const supabase = await createClient()

  const id = formData.get('id') as string
  const { error } = await supabase.from('categorias').delete().eq('id', id)

  if (error) {
    redirect(
      `/categorias?error=${encodeURIComponent('Categoria em uso não pode ser removida')}`
    )
  }

  revalidatePath('/categorias')
  redirect('/categorias')
}

'use client'

export function ChecklistFormClient({
  action,
  itensCount,
  className,
  children,
}: {
  action: (formData: FormData) => void
  itensCount: number
  className?: string
  children: React.ReactNode
}) {
  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    const form = e.currentTarget
    const semObservacao: number[] = []

    for (let i = 0; i < itensCount; i++) {
      const respostaField = form.elements.namedItem(`resposta_${i}`)
      const valor = respostaField instanceof RadioNodeList ? respostaField.value : ''
      const obsField = form.elements.namedItem(`observacao_${i}`) as HTMLTextAreaElement | null
      const obs = obsField?.value?.trim() ?? ''

      if (valor === 'nao' && !obs) {
        semObservacao.push(i + 1)
      }
    }

    if (semObservacao.length > 0) {
      const ok = confirm(
        `Os itens ${semObservacao.join(', ')} estão marcados "Não" sem observação preenchida. Deseja salvar mesmo assim?`
      )
      if (!ok) {
        e.preventDefault()
      }
    }
  }

  return (
    <form action={action} onSubmit={handleSubmit} className={className}>
      {children}
    </form>
  )
}

'use client'

import { useFormStatus } from 'react-dom'

// Desabilita o botão assim que o form é enviado, até a resposta do servidor
// voltar — evita clique duplo (ou toque duplo no celular) mandando o mesmo
// registro duas vezes, como aconteceu na Ficha.
export function SubmitButton({
  children,
  pendingText,
  className,
}: {
  children: React.ReactNode
  pendingText?: string
  className?: string
}) {
  const { pending } = useFormStatus()

  return (
    <button type="submit" className={className} disabled={pending}>
      {pending ? pendingText ?? 'Enviando…' : children}
    </button>
  )
}

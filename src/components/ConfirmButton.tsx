'use client'

export function ConfirmButton({
  confirmMessage,
  className,
  children,
  formAction,
}: {
  confirmMessage: string
  className?: string
  children: React.ReactNode
  // Só necessário quando o botão fica dentro de um <form> com outra action
  // (ex.: excluir dentro do form de editar) — usa o formAction nativo do
  // HTML pra submeter pra uma action diferente da do form.
  formAction?: (formData: FormData) => void
}) {
  return (
    <button
      type="submit"
      className={className}
      formAction={formAction}
      onClick={(e) => {
        if (!confirm(confirmMessage)) {
          e.preventDefault()
        }
      }}
    >
      {children}
    </button>
  )
}

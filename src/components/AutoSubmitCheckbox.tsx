'use client'

// Checkbox que salva sozinho ao marcar/desmarcar — sem precisar clicar em
// "Salvar" separado, pra não confundir com o Salvar de outro campo da tela.
export function AutoSubmitCheckbox({
  name,
  defaultChecked,
}: {
  name: string
  defaultChecked: boolean
}) {
  return (
    <input
      type="checkbox"
      name={name}
      defaultChecked={defaultChecked}
      onChange={(e) => e.currentTarget.form?.requestSubmit()}
    />
  )
}

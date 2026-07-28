'use client'

import { useState } from 'react'

// Checkbox que salva sozinho ao marcar/desmarcar — sem precisar clicar em
// "Salvar" separado, pra não confundir com o Salvar de outro campo da tela.
// O check e o selo "Feito" aparecem na hora, direto no navegador, sem
// esperar a página recarregar — assim dá tempo de digitar o local antes de
// o item ser reordenado pra "Concluídos" (isso só acontece quando salva
// o local ou recarrega a página).
export function AutoSubmitCheckbox({
  name,
  defaultChecked,
}: {
  name: string
  defaultChecked: boolean
}) {
  const [checked, setChecked] = useState(defaultChecked)

  return (
    <>
      <input
        type="checkbox"
        name={name}
        checked={checked}
        onChange={(e) => {
          setChecked(e.currentTarget.checked)
          e.currentTarget.form?.requestSubmit()
        }}
      />
      {checked && <span className="badge badge-aprovado">✓ Feito</span>}
    </>
  )
}

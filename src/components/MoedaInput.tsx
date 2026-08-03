'use client'

import { useState } from 'react'
import { maskMoeda } from '@/lib/mask'

// Campo de moeda padrão do sistema: "R$" fixo do lado + máscara "70.000,00"
// enquanto digita. Não-controlado (guarda o próprio estado) pra poder ser
// usado direto num formulário renderizado no servidor.
export function MoedaInput({
  name,
  defaultValue = '',
  required,
}: {
  name: string
  defaultValue?: string
  required?: boolean
}) {
  const [value, setValue] = useState(defaultValue)

  return (
    <div className="flex items-center gap-2">
      <span className="text-[.8rem] text-[var(--text-muted)]">R$</span>
      <input
        name={name}
        type="text"
        inputMode="numeric"
        className="flex-1"
        value={value}
        placeholder="0,00"
        required={required}
        onChange={(e) => setValue(maskMoeda(e.target.value))}
      />
    </div>
  )
}

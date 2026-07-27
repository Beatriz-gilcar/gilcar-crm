'use client'

import { useState } from 'react'
import { maskTelefone } from '@/lib/mask'

// Input de telefone com a mesma máscara da Ordem de Serviço: (21) 99999-9999.
export function TelefoneInput({
  name,
  defaultValue = '',
  placeholder = '(21) 99999-9999',
  className,
}: {
  name: string
  defaultValue?: string
  placeholder?: string
  className?: string
}) {
  const [valor, setValor] = useState(defaultValue ? maskTelefone(defaultValue) : '')
  return (
    <input
      name={name}
      type="tel"
      inputMode="numeric"
      value={valor}
      onChange={(e) => setValor(maskTelefone(e.target.value))}
      placeholder={placeholder}
      className={className}
    />
  )
}

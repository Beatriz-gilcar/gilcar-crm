'use client'

import { useEffect } from 'react'

// Registra o service worker (public/sw.js) — é o que faltava, além do
// manifesto, pra alguns navegadores (Chrome/Android) oferecerem "Instalar
// app"/"Adicionar à tela inicial" de forma confiável.
export function RegisterServiceWorker() {
  useEffect(() => {
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.register('/sw.js').catch(() => {})
    }
  }, [])

  return null
}

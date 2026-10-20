import type { MetadataRoute } from 'next'

// Deixa o CRM instalável na tela inicial do celular (PWA) — ícone próprio,
// abre em tela cheia sem a barra do navegador. Next.js serve isso
// automaticamente em /manifest.webmanifest a partir deste arquivo.
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'Gilcar CRM',
    short_name: 'Gilcar',
    description: 'CRM de leads e atendimentos — Gilcar Veículos',
    start_url: '/',
    display: 'standalone',
    background_color: '#0d1420',
    theme_color: '#0d1420',
    icons: [
      { src: '/icon-192.png', sizes: '192x192', type: 'image/png' },
      { src: '/icon-512.png', sizes: '512x512', type: 'image/png' },
    ],
  }
}

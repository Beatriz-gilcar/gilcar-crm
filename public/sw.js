// Service worker mínimo — só pra habilitar a instalação como PWA (ícone na
// tela inicial). Sem cache: o CRM tem dado em tempo real (estoque, vendas,
// metas, lembretes), cachear agressivamente ia mostrar informação
// desatualizada. Todo fetch vai direto pra rede, sem interceptar nada.
self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', (event) => event.waitUntil(self.clients.claim()));

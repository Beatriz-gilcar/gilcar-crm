import Link from 'next/link'
import { logout } from '@/app/actions'
import { TopbarMais } from './TopbarMais'

type NavKey =
  | 'ficha'
  | 'rotina'
  | 'lembretes'
  | 'dashboard'
  | 'status-do-dia'
  | 'estoque'
  | 'ordens'
  | 'pos-venda'
  | 'abastecimento'
  | 'metas'
  | 'premiacao'
  | 'sdr'
  | 'gerencia'
  | 'admin'
  | 'mural'
  | 'holerites'
  | 'holerites-rh'

// Abas usadas várias vezes por dia: continuam soltas no menu. O resto entra
// no painel "Mais" (ver GRUPOS_MAIS) pra não estourar a largura — o nav
// completo chegou a ter 14 abas numa fileira só.
const FIXOS: NavKey[] = ['ficha', 'rotina', 'ordens', 'estoque', 'pos-venda', 'dashboard']

const GRUPOS_MAIS: { titulo: string; chaves: NavKey[] }[] = [
  { titulo: 'Atendimento', chaves: ['status-do-dia', 'abastecimento'] },
  { titulo: 'Resultados', chaves: ['metas', 'premiacao'] },
  { titulo: 'Equipe', chaves: ['mural', 'holerites', 'holerites-rh', 'sdr', 'admin'] },
]

export function Topbar({
  nome,
  cargo,
  // Quem enxerga as abas de gestão, escrevendo ou não: gerência e visualizador.
  // É podeVerTudo(), não isGerenciaCargo() — o visualizador precisa chegar nas
  // telas pra ler, e são as policies do banco que impedem ele de escrever.
  verTudo,
  isAdmin = false,
  gerenciaHolerites = false,
  active,
}: {
  nome: string
  cargo: string
  verTudo: boolean
  isAdmin?: boolean
  // Painel de gestão de Holerites: restrito à Beatriz (flag por pessoa),
  // não a qualquer admin — Junior é admin mas não gerencia esse módulo.
  gerenciaHolerites?: boolean
  active: NavKey | ''
}) {
  // Cargo pos_venda (Luciana) tem um nav enxuto: só o módulo dela e o Estoque
  // (que ela consulta, sem editar). Não polui a tela dela com abas que ela não
  // usa e cujas policies do banco não deixariam escrever mesmo.
  const isPosVenda = cargo === 'pos_venda'
  // Equipe de SDR (inclui a gerente delas): nav enxuto, aba de lançamento +
  // Estoque (consulta, sem editar).
  const isSdrCargo = cargo === 'sdr'
  // Social Media (Pedro Fábio): só precisa ver o Estoque, pro conteúdo dos
  // veículos. Nav mais enxuto de todos.
  const isSocialMedia = cargo === 'social_media'

  const navItems: { key: NavKey; href: string; label: string }[] = isSdrCargo
    ? [
        { key: 'sdr', href: '/sdr', label: 'SDR' },
        { key: 'estoque', href: '/estoque', label: 'Estoque' },
      ]
    : isPosVenda
    ? [
        { key: 'pos-venda', href: '/pos-venda', label: 'Pós-venda' },
        { key: 'abastecimento', href: '/abastecimento', label: 'Abastecimento' },
        { key: 'estoque', href: '/estoque', label: 'Estoque' },
      ]
    : isSocialMedia
    ? [{ key: 'estoque', href: '/estoque', label: 'Estoque' }]
    : [
        { key: 'ficha', href: '/ficha', label: 'Ficha' },
        { key: 'rotina', href: '/rotina', label: 'Rotina do Dia' },
        // Só quem cuida disso de fato: gerente da unidade (recebe o aviso) e
        // admin (edita o dia junto com a Luciana). Consultor não usa esta tela.
        ...(cargo === 'gerente' || isAdmin
          ? [{ key: 'abastecimento' as const, href: '/abastecimento', label: 'Abastecimento' }]
          : []),
        // Uma aba só: Consultores (Status do Dia) e Gerentes (Gerência) ficam
        // como sub-abas dentro da mesma tela.
        ...(verTudo ? [{ key: 'status-do-dia' as const, href: '/status-do-dia', label: 'Status do Dia' }] : []),
        { key: 'ordens', href: '/ordens', label: 'Ordens' },
        { key: 'metas', href: '/metas', label: 'Metas' },
        { key: 'premiacao', href: '/premiacao', label: 'Premiação' },
        { key: 'estoque', href: '/estoque', label: 'Estoque' },
        { key: 'pos-venda', href: '/pos-venda', label: 'Pós-venda' },
        { key: 'holerites', href: '/holerites', label: 'Holerites' },
        { key: 'mural', href: '/mural', label: 'Mural' },
        { key: 'dashboard', href: '/dashboard', label: 'Dashboard' },
      ]

  // Mural e Holerites são de todo mundo, sem exceção de cargo — nos naves
  // enxutos (SDR/pós-venda/social media) entram no fim, já que o branch acima
  // cobre a ordem específica pedida pro nav completo.
  if (isSdrCargo || isPosVenda || isSocialMedia) {
    navItems.push({ key: 'holerites', href: '/holerites', label: 'Holerites' })
    navItems.push({ key: 'mural', href: '/mural', label: 'Mural' })
  }

  if (isSdrCargo && verTudo) {
    navItems.push({ key: 'status-do-dia', href: '/status-do-dia', label: 'Status do Dia' })
  }

  if (isAdmin) {
    // Consolidado de SDR: só o admin (Junior) vê.
    navItems.push({ key: 'sdr', href: '/sdr', label: 'SDR' })
    navItems.push({ key: 'admin', href: '/admin', label: 'Admin' })
  }

  if (gerenciaHolerites) {
    navItems.push({ key: 'holerites-rh', href: '/holerites/rh', label: 'Holerites RH' })
  }

  // Nav enxuto (SDR, pós-venda, social media) já cabe numa linha só — só o
  // nav completo (gerência pra cima) precisa do agrupamento em "Mais".
  const agrupar = !isSdrCargo && !isPosVenda && !isSocialMedia
  const itensSoltos = agrupar ? navItems.filter((item) => FIXOS.includes(item.key)) : navItems
  const grupos = agrupar
    ? GRUPOS_MAIS.map((grupo) => ({
        titulo: grupo.titulo,
        itens: grupo.chaves
          .map((chave) => navItems.find((item) => item.key === chave))
          .filter((item): item is (typeof navItems)[number] => Boolean(item)),
      }))
    : []

  return (
    <>
      <div className="flex items-center justify-between border-b border-[var(--border)] bg-[var(--surface)] px-5 py-2.5">
        <Link href="/" className="flex items-center gap-3">
          <span className="logo-gilcar">Gilcar</span>
          <div className="ml-1 flex flex-col justify-center border-l border-[var(--border)] pl-2.5">
            <span className="logo-sub">tratos e</span>
            <span className="logo-sub">combinados</span>
          </div>
        </Link>
        <div className="rounded-full border border-[var(--border)] bg-[var(--bg)] px-3 py-1 text-[.78rem] tracking-wide text-[var(--text-muted)]">
          {nome} · {cargo}
        </div>
      </div>
      <div className="flex items-center gap-1 border-b border-[var(--border)] bg-[var(--surface)] px-3 py-2">
        {/*
          A rolagem horizontal fica só nesta faixa interna — se o "Mais" ficasse
          dentro dela, o overflow-x:auto força overflow-y:auto junto (regra do
          CSS: um eixo non-visible converte o outro), e isso corta o painel
          absolute por baixo em vez de deixar ele flutuar livre.
        */}
        <div className="flex min-w-0 items-center gap-1 overflow-x-auto">
          {itensSoltos.map((item) => (
            <Link
              key={item.key}
              href={item.href}
              className={`whitespace-nowrap rounded-full px-4 py-2 text-[.75rem] font-bold tracking-wide transition-colors ${
                active === item.key
                  ? 'bg-[var(--coral)] text-white'
                  : 'text-[var(--text-muted)] hover:bg-white/5 hover:text-white'
              }`}
            >
              {item.label}
            </Link>
          ))}
        </div>
        {agrupar && <TopbarMais grupos={grupos} active={active} />}
        <form action={logout} className="ml-auto flex items-center px-2">
          <button
            type="submit"
            className="rounded-full px-4 py-2 text-[.72rem] font-bold tracking-wide text-[var(--text-muted)] hover:bg-white/5 hover:text-white"
          >
            Sair
          </button>
        </form>
      </div>
    </>
  )
}

import Link from 'next/link'
import { logout } from '@/app/actions'

type NavKey = 'leads' | 'lembretes' | 'dashboard' | 'status-do-dia' | 'categorias'

export function Topbar({
  nome,
  cargo,
  isGerencia,
  active,
}: {
  nome: string
  cargo: string
  isGerencia: boolean
  active: NavKey | ''
}) {
  const navItems: { key: NavKey; href: string; label: string }[] = [
    { key: 'leads', href: '/leads', label: 'Leads' },
    { key: 'lembretes', href: '/lembretes', label: 'Lembretes' },
    { key: 'dashboard', href: '/dashboard', label: 'Dashboard' },
  ]

  if (isGerencia) {
    navItems.push({ key: 'status-do-dia', href: '/status-do-dia', label: 'Status do Dia' })
    navItems.push({ key: 'categorias', href: '/categorias', label: 'Categorias' })
  }

  return (
    <>
      <div className="flex items-center justify-between border-b-2 border-[var(--red)] bg-[var(--surface)] px-5 py-2.5">
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
      <div className="flex overflow-x-auto border-b border-[var(--border)] bg-[var(--surface)]">
        {navItems.map((item) => (
          <Link
            key={item.key}
            href={item.href}
            className={`whitespace-nowrap border-b-[3px] px-4 py-3 text-[.75rem] font-bold tracking-wide transition-colors ${
              active === item.key
                ? 'border-[var(--red)] bg-[var(--bg)] text-white'
                : 'border-transparent text-[var(--text-muted)] hover:text-white'
            }`}
          >
            {item.label}
          </Link>
        ))}
        <form action={logout} className="ml-auto flex items-center px-4">
          <button
            type="submit"
            className="text-[.72rem] font-bold tracking-wide text-[var(--text-muted)] hover:text-white"
          >
            Sair
          </button>
        </form>
      </div>
    </>
  )
}

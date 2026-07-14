import Link from 'next/link'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { Topbar } from '@/components/Topbar'

type ProfileSummary = { nome: string; cargo: string }

const linhas: { decisao: string; consultor: boolean | string; gerente: boolean | string; admin: boolean | string }[] = [
  { decisao: 'Registrar atendimento (presencial/digital)', consultor: true, gerente: true, admin: true },
  { decisao: 'Cadastrar/editar veículo no estoque da própria unidade', consultor: true, gerente: true, admin: true },
  { decisao: 'Conceder desconto dentro do padrão da unidade', consultor: false, gerente: true, admin: true },
  { decisao: 'Conceder desconto acima do padrão', consultor: false, gerente: false, admin: true },
  { decisao: 'Aprovar ordem de serviço', consultor: false, gerente: true, admin: true },
  { decisao: 'Assinar ordem de serviço aprovada', consultor: false, gerente: 'própria unidade', admin: true },
  { decisao: 'Aprovar o Status do Dia da unidade', consultor: false, gerente: true, admin: true },
  { decisao: 'Editar veículo de outra unidade', consultor: false, gerente: false, admin: true },
  { decisao: 'Criar login e definir cargo/unidade da equipe', consultor: false, gerente: false, admin: true },
  { decisao: 'Redefinir senha de acesso', consultor: false, gerente: false, admin: true },
  { decisao: 'Definir metas da unidade', consultor: false, gerente: 'sugere', admin: 'decide' },
  { decisao: 'Contratar vendedor', consultor: false, gerente: 'sugere', admin: 'decide' },
  { decisao: 'Desligar vendedor', consultor: false, gerente: 'sugere', admin: 'decide' },
]

function Celula({ valor }: { valor: boolean | string }) {
  if (valor === true) return <span className="badge badge-aprovado">Sim</span>
  if (valor === false) return <span className="text-[var(--text-muted)]">—</span>
  return <span className="badge badge-pendente">{valor}</span>
}

export default async function ReguaDecisaoPage() {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return null
  }

  const { data: profile } = await supabase
    .from('profiles')
    .select('nome, cargo')
    .eq('id', user.id)
    .single<ProfileSummary>()

  const isGerencia = profile?.cargo === 'admin' || profile?.cargo === 'gerente'
  const isAdmin = profile?.cargo === 'admin'

  if (!isGerencia) {
    redirect('/')
  }

  return (
    <>
      <Topbar
        nome={profile?.nome ?? user.email ?? ''}
        cargo={profile?.cargo ?? ''}
        isGerencia={isGerencia}
        isAdmin={isAdmin}
        active="gerencia"
      />
      <div className="flex flex-1 flex-col gap-4 px-4 py-8 sm:px-10">
        <div className="mx-auto w-full max-w-4xl">
          <Link href="/gerencia" className="text-[.72rem] text-[var(--text-muted)] hover:text-white">
            ← Gerência
          </Link>

          <div className="mt-3">
            <div className="sec-header">
              <div className="sec-title">Régua de Decisão</div>
            </div>
            <p className="mb-3 text-[.75rem] normal-case text-[var(--text-muted)]">
              Referência de quem decide o quê, do desconto ao desligamento de vendedor. Tela
              informativa, não editável.
            </p>
            <div className="sec-body table-wrap" style={{ padding: 0 }}>
              <table>
                <thead>
                  <tr>
                    <th>Decisão</th>
                    <th>Consultor</th>
                    <th>Gerente</th>
                    <th>Admin</th>
                  </tr>
                </thead>
                <tbody>
                  {linhas.map((linha) => (
                    <tr key={linha.decisao}>
                      <td className="normal-case text-white">{linha.decisao}</td>
                      <td>
                        <Celula valor={linha.consultor} />
                      </td>
                      <td>
                        <Celula valor={linha.gerente} />
                      </td>
                      <td>
                        <Celula valor={linha.admin} />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>
    </>
  )
}

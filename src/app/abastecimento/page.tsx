import { createClient } from '@/lib/supabase/server'
import { Topbar } from '@/components/Topbar'
import { podeVerTudo } from '@/lib/membros'
import { agoraNaLoja, diasSemana } from '@/lib/datas'
import { salvarDiaAbastecimento } from './actions'

type ProfileSummary = { nome: string; cargo: string }
type Unidade = { id: string; nome: string }
type Config = { unidade_id: string; dia_semana: number }

// Próxima data (dd/mm/aaaa) em que cai o dia_semana configurado, a partir de
// hoje na loja — hoje conta como "próximo" se for o próprio dia.
function proximaData(diaSemana: number): string {
  const agora = agoraNaLoja()
  const diaHoje = agora.getUTCDay()
  const diffDias = (diaSemana - diaHoje + 7) % 7
  const alvo = new Date(agora)
  alvo.setUTCDate(alvo.getUTCDate() + diffDias)
  return alvo.toLocaleDateString('pt-BR', { timeZone: 'UTC' })
}

export default async function AbastecimentoPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; success?: string }>
}) {
  const { error, success } = await searchParams
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

  const verTudo = podeVerTudo(profile?.cargo)
  const isAdmin = profile?.cargo === 'admin'
  const podeAcessar = profile?.cargo === 'gerente' || profile?.cargo === 'pos_venda' || isAdmin

  if (!podeAcessar) {
    return null
  }
  // Quem define o dia de abastecimento: a Luciana (pos_venda, quem cuida
  // disso de fato) e o admin.
  const podeEditar = isAdmin || profile?.cargo === 'pos_venda'

  const { data: unidadesData } = await supabase.from('unidades').select('id, nome').order('nome')
  const unidades = (unidadesData ?? []) as Unidade[]

  const { data: configsData } = await supabase.from('abastecimento_config').select('unidade_id, dia_semana')
  const configs = new Map((configsData ?? []).map((c: Config) => [c.unidade_id, c.dia_semana]))

  return (
    <>
      <Topbar
        nome={profile?.nome ?? user.email ?? ''}
        cargo={profile?.cargo ?? ''}
        verTudo={verTudo}
        isAdmin={isAdmin}
        active="abastecimento"
      />
      <div className="flex flex-1 justify-center px-4 py-8">
        <div className="w-full max-w-2xl flex flex-col gap-4">
          <div className="sec-header">
            <div className="sec-title">Abastecimento</div>
          </div>

          {error && (
            <p className="rounded-2xl bg-[var(--danger-soft)] px-3 py-2 text-[.78rem] normal-case text-[var(--danger)]">
              {error}
            </p>
          )}
          {success === '1' && (
            <p className="rounded-2xl bg-[var(--success-soft)] px-3 py-2 text-[.78rem] normal-case text-[var(--success)]">
              Dia salvo.
            </p>
          )}

          <div className="sec-body" style={{ padding: 0 }}>
            {unidades.map((u) => {
              const diaAtual = configs.get(u.id)
              return (
                <div
                  key={u.id}
                  className="flex flex-wrap items-center justify-between gap-3 border-t border-[var(--border)] px-4 py-3 first:border-t-0"
                >
                  <div>
                    <p className="normal-case text-white font-semibold">{u.nome}</p>
                    <p className="text-[.72rem] text-[var(--text-muted)]">
                      {diaAtual !== undefined
                        ? `${diasSemana[diaAtual]} · próximo: ${proximaData(diaAtual)}`
                        : 'Dia ainda não definido'}
                    </p>
                  </div>
                  {podeEditar && (
                    <form action={salvarDiaAbastecimento} className="flex items-center gap-2">
                      <input type="hidden" name="unidade_id" value={u.id} />
                      <select name="dia_semana" defaultValue={diaAtual ?? ''}>
                        <option value="" disabled>
                          Selecione...
                        </option>
                        {diasSemana.map((label, i) => (
                          <option key={i} value={i}>
                            {label}
                          </option>
                        ))}
                      </select>
                      <button type="submit" className="btn btn-outline btn-sm">
                        Salvar
                      </button>
                    </form>
                  )}
                </div>
              )
            })}
          </div>

          <p className="text-[.72rem] normal-case text-[var(--text-muted)]">
            O gerente da unidade recebe um aviso dentro do sistema um dia antes e na manhã do dia certo.
          </p>
        </div>
      </div>
    </>
  )
}

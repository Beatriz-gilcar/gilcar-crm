import Link from 'next/link'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { Topbar } from '@/components/Topbar'
import { ConfirmButton } from '@/components/ConfirmButton'
import { podeVerTudo } from '@/lib/membros'
import { mesAtualISO, mesRange, mesLabel } from '@/lib/metas'
import { formatBRL } from '@/lib/ordens'
import { deleteDespesa } from './actions'

type ProfileSummary = { nome: string; cargo: string; ve_despesas: boolean }
type Unidade = { id: string; nome: string }
type DespesaRow = {
  id: string
  unidade_id: string | null
  categoria: string
  descricao: string | null
  valor: number
  unidades: { nome: string } | null
}
type OrdemVenda = { unidade_id: string; valor_total: number; desconto: number }

const categoriaLabel: Record<string, string> = {
  aluguel: 'Aluguel',
  folha: 'Folha',
  agua_luz: 'Água/Luz',
  internet_telefone: 'Internet/Telefone',
  manutencao: 'Manutenção',
  marketing: 'Marketing',
  fornecedor: 'Fornecedor',
  outros: 'Outros',
}

function ResultadoCard({
  titulo,
  receita,
  despesa,
}: {
  titulo: string
  receita: number
  despesa: number
}) {
  const resultado = receita - despesa
  const cor = resultado >= 0 ? 'var(--success)' : 'var(--danger)'
  return (
    <div className="card sec-pad">
      <p className="font-semibold text-white">{titulo}</p>
      <p className="mt-1 text-[1.3rem] font-extrabold" style={{ color: cor }}>
        {formatBRL(resultado)}
      </p>
      <div className="mt-2 flex items-center justify-between text-[.72rem] normal-case text-[var(--text-muted)]">
        <span>Receita: {formatBRL(receita)}</span>
        <span>Despesas: {formatBRL(despesa)}</span>
      </div>
    </div>
  )
}

export default async function DespesasPage({
  searchParams,
}: {
  searchParams: Promise<{ mes?: string; error?: string }>
}) {
  const { mes: mesParam, error } = await searchParams
  const mes = mesParam || mesAtualISO()
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return null
  }

  const { data: profile } = await supabase
    .from('profiles')
    .select('nome, cargo, ve_despesas')
    .eq('id', user.id)
    .single<ProfileSummary>()

  if (!profile?.ve_despesas) {
    redirect('/')
  }

  const verTudo = podeVerTudo(profile.cargo)
  const isAdmin = profile.cargo === 'admin'
  const { inicio, fim } = mesRange(mes)

  const [{ data: unidadesData }, { data: despesasData }, { data: ordensData }, { data: posVendaData }] =
    await Promise.all([
      supabase.from('unidades').select('id, nome').order('nome'),
      supabase
        .from('despesas')
        .select('id, unidade_id, categoria, descricao, valor, unidades(nome)')
        .eq('competencia', `${mes}-01`)
        .order('created_at', { ascending: false })
        .overrideTypes<DespesaRow[]>(),
      supabase
        .from('ordens_servico')
        .select('unidade_id, valor_total, desconto')
        .eq('status', 'aprovada')
        .eq('tipo', 'venda')
        .gte('data_venda', inicio)
        .lt('data_venda', fim)
        .overrideTypes<OrdemVenda[]>(),
      // pos_venda_lancamentos não tem unidade_id (só placa, texto livre) —
      // não dá pra quebrar por loja com confiança, então entra só no total
      // Empresa, não nos cards por unidade.
      supabase
        .from('pos_venda_lancamentos')
        .select('valor')
        .gte('data', inicio)
        .lt('data', fim)
        .overrideTypes<{ valor: number }[]>(),
    ])

  const unidades = (unidadesData ?? []) as Unidade[]
  const despesas = despesasData ?? []
  const ordens = ordensData ?? []
  const posVendaTotal = (posVendaData ?? []).reduce((a, l) => a + Number(l.valor), 0)

  const receitaPorUnidade = new Map<string, number>()
  for (const o of ordens) {
    const liquido = Number(o.valor_total) - Number(o.desconto)
    receitaPorUnidade.set(o.unidade_id, (receitaPorUnidade.get(o.unidade_id) ?? 0) + liquido)
  }

  const despesaPorUnidade = new Map<string, number>()
  let despesaGeral = 0
  for (const d of despesas) {
    if (d.unidade_id) {
      despesaPorUnidade.set(d.unidade_id, (despesaPorUnidade.get(d.unidade_id) ?? 0) + Number(d.valor))
    } else {
      despesaGeral += Number(d.valor)
    }
  }

  const receitaTotal = [...receitaPorUnidade.values()].reduce((a, b) => a + b, 0)
  const despesaTotal = despesas.reduce((a, d) => a + Number(d.valor), 0) + posVendaTotal

  return (
    <>
      <Topbar
        nome={profile.nome ?? user.email ?? ''}
        cargo={profile.cargo ?? ''}
        verTudo={verTudo}
        isAdmin={isAdmin}
        veDespesas={profile.ve_despesas}
        active="despesas"
      />
      <div className="flex flex-1 flex-col gap-6 px-4 py-8 sm:px-10">
        <div className="mx-auto w-full max-w-4xl">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="sec-title" style={{ borderBottom: 'none', paddingBottom: 0 }}>
              Despesas por unidade
            </div>
            <div className="flex flex-wrap gap-2">
              <form method="get" className="flex items-center gap-2">
                <input name="mes" type="month" defaultValue={mes} />
                <button type="submit" className="btn btn-outline btn-sm">
                  Ver
                </button>
              </form>
              <Link href="/despesas/new" className="btn btn-red btn-sm">
                + Lançar despesa
              </Link>
            </div>
          </div>

          {error && (
            <p className="mt-3 rounded-2xl bg-[var(--danger-soft)] px-3 py-2 text-[.78rem] normal-case text-[var(--danger)]">
              {error}
            </p>
          )}

          <p className="mt-1 text-[.72rem] normal-case text-[var(--text-muted)]">{mesLabel(mes)}</p>

          <div className="mt-4 flex flex-col gap-4">
            <ResultadoCard titulo="Empresa" receita={receitaTotal} despesa={despesaTotal} />
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              {unidades.map((u) => (
                <ResultadoCard
                  key={u.id}
                  titulo={u.nome}
                  receita={receitaPorUnidade.get(u.id) ?? 0}
                  despesa={despesaPorUnidade.get(u.id) ?? 0}
                />
              ))}
            </div>
          </div>

          <p className="mt-3 text-[.7rem] normal-case text-[var(--text-muted)]">
            Resultado = receita de venda aprovada (valor − desconto) menos despesa lançada aqui. Ainda não desconta
            comissão (isso fica no Gestão Gilcar).
            {despesaGeral > 0 && ` Despesa geral (sem unidade) neste mês: ${formatBRL(despesaGeral)}, só entra no card Empresa.`}
            {posVendaTotal > 0 &&
              ` Lançamentos do Pós-venda (peças/fornecedor) neste mês: ${formatBRL(posVendaTotal)} — sem unidade cadastrada lá, então também só entram no card Empresa.`}
          </p>

          <div className="mt-6">
            <div className="sec-title" style={{ borderBottom: 'none', paddingBottom: 0 }}>
              Despesas lançadas
            </div>
            <div className="sec-body mt-2" style={{ padding: 0 }}>
              {despesas.length === 0 ? (
                <div className="empty-state">Nenhuma despesa lançada em {mesLabel(mes)}.</div>
              ) : (
                <div className="flex flex-col">
                  {despesas.map((d) => (
                    <div
                      key={d.id}
                      className="flex items-center justify-between gap-3 border-t border-[var(--border)] px-4 py-2.5 first:border-t-0"
                    >
                      <div className="normal-case">
                        <p className="text-white">
                          {categoriaLabel[d.categoria] ?? d.categoria} · {d.unidades?.nome ?? 'Geral (empresa)'}
                        </p>
                        {d.descricao && <p className="text-[.72rem] text-[var(--text-muted)]">{d.descricao}</p>}
                      </div>
                      <div className="flex items-center gap-3">
                        <span className="font-semibold text-white">{formatBRL(Number(d.valor))}</span>
                        <form action={deleteDespesa}>
                          <input type="hidden" name="id" value={d.id} />
                          <input type="hidden" name="mes" value={mes} />
                          <ConfirmButton
                            className="text-[.72rem] font-bold text-[var(--red)] hover:underline"
                            confirmMessage="Excluir essa despesa?"
                          >
                            Excluir
                          </ConfirmButton>
                        </form>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </>
  )
}

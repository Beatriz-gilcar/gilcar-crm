import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { Topbar } from '@/components/Topbar'
import { ConfirmButton } from '@/components/ConfirmButton'
import { MoedaInput } from '@/components/MoedaInput'
import { podeVerTudo, podeEditarPosVenda } from '@/lib/membros'
import { formatBRLNumber } from '@/lib/mask'
import { criarLancamentoPosVenda, excluirLancamentoPosVenda } from './actions'

type Lancamento = {
  id: string
  data: string
  veiculo_placa: string | null
  descricao: string
  fornecedor: string
  valor: number
  observacao: string | null
}

type ProfileSummary = { nome: string; cargo: string }

function hojeISO() {
  return new Date().toISOString().slice(0, 10)
}

export default async function LancamentosPosVendaPage({
  searchParams,
}: {
  searchParams: Promise<{ data?: string; error?: string }>
}) {
  const { data: dataParam, error } = await searchParams
  const data = dataParam || hojeISO()
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
  const podeEditar = podeEditarPosVenda(profile?.cargo)

  const { data: lancamentosData } = await supabase
    .from('pos_venda_lancamentos')
    .select('id, data, veiculo_placa, descricao, fornecedor, valor, observacao')
    .eq('data', data)
    .order('created_at', { ascending: true })
    .overrideTypes<Lancamento[]>()
  const lancamentos = lancamentosData ?? []

  // Sugestão de fornecedor já usado, pra não fragmentar o total por causa de
  // grafia diferente ("Onik" vs "onik distribuidora") — os últimos 200 bastam
  // pra alimentar a lista sem pesar a consulta.
  const { data: fornecedoresData } = await supabase
    .from('pos_venda_lancamentos')
    .select('fornecedor')
    .order('created_at', { ascending: false })
    .limit(200)
    .overrideTypes<{ fornecedor: string }[]>()
  const fornecedoresSugeridos = [...new Set((fornecedoresData ?? []).map((f) => f.fornecedor))].sort()

  const totalDia = lancamentos.reduce((soma, l) => soma + Number(l.valor), 0)

  // Agrupa por fornecedor (normalizando maiúsculas/minúsculas e espaço nas
  // pontas) — é o que a Luciana pediu: um somatório por fornecedor quando
  // houver mais de um lançamento pra ele.
  const porFornecedor = new Map<string, { nome: string; total: number; qtd: number }>()
  for (const l of lancamentos) {
    const chave = l.fornecedor.trim().toLowerCase()
    const atual = porFornecedor.get(chave) ?? { nome: l.fornecedor.trim(), total: 0, qtd: 0 }
    atual.total += Number(l.valor)
    atual.qtd += 1
    porFornecedor.set(chave, atual)
  }
  const gruposFornecedor = [...porFornecedor.values()].sort((a, b) => b.total - a.total)

  const dataBR = data.split('-').reverse().join('/')
  const mensagemWhatsapp = [
    `*Pós-venda — Lançamentos de ${dataBR}*`,
    '',
    ...lancamentos.map(
      (l) =>
        `• ${l.descricao}${l.veiculo_placa ? ` · ${l.veiculo_placa}` : ''} — ${l.fornecedor} — R$ ${formatBRLNumber(Number(l.valor))}`
    ),
    '',
    '*Total por fornecedor:*',
    ...gruposFornecedor.map((g) => `• ${g.nome}: R$ ${formatBRLNumber(g.total)} (${g.qtd} lançamento${g.qtd > 1 ? 's' : ''})`),
    '',
    `*Total do dia: R$ ${formatBRLNumber(totalDia)}*`,
  ].join('\n')
  const linkWhatsapp = `https://wa.me/?text=${encodeURIComponent(mensagemWhatsapp)}`

  return (
    <>
      <Topbar
        nome={profile?.nome ?? user.email ?? ''}
        cargo={profile?.cargo ?? ''}
        verTudo={verTudo}
        isAdmin={isAdmin}
        active="pos-venda"
      />
      <div className="flex flex-1 flex-col gap-6 px-4 py-8 sm:px-10">
        <div className="mx-auto w-full max-w-5xl">
          <div className="chip-row">
            <Link href="/pos-venda" className="toggle-btn">
              Registros
            </Link>
            <Link href="/pos-venda/lancamentos" className="toggle-btn ativo">
              Lançamentos
            </Link>
          </div>

          <div className="mt-3 flex items-center justify-between">
            <div className="sec-title" style={{ borderBottom: 'none', paddingBottom: 0 }}>
              Lançamentos do dia
            </div>
            <form method="get" className="flex items-end gap-2">
              <div className="form-group" style={{ marginBottom: 0, minWidth: 160 }}>
                <input type="date" name="data" defaultValue={data} />
              </div>
              <button type="submit" className="btn btn-outline btn-sm">
                Ver
              </button>
            </form>
          </div>

          {error && (
            <p className="mt-3 rounded-2xl bg-[var(--danger-soft)] px-3 py-2 text-[.78rem] normal-case text-[var(--danger)]">
              {error}
            </p>
          )}

          {podeEditar && (
            <form action={criarLancamentoPosVenda} className="card sec-pad mt-4 flex flex-col gap-3">
              <input type="hidden" name="data" value={data} />
              <div className="grid2">
                <div className="form-group" style={{ marginBottom: 0 }}>
                  <label>Placa do veículo</label>
                  <input name="veiculo_placa" type="text" placeholder="ABC-1234" />
                </div>
                <div className="form-group" style={{ marginBottom: 0 }}>
                  <label>Descrição</label>
                  <input name="descricao" type="text" placeholder="Ex.: Correia do alternador" required />
                </div>
              </div>
              <div className="grid2">
                <div className="form-group" style={{ marginBottom: 0 }}>
                  <label>Fornecedor</label>
                  <input name="fornecedor" type="text" placeholder="Ex.: Onik" required list="fornecedores-sugeridos" />
                  <datalist id="fornecedores-sugeridos">
                    {fornecedoresSugeridos.map((f) => (
                      <option key={f} value={f} />
                    ))}
                  </datalist>
                </div>
                <div className="form-group" style={{ marginBottom: 0 }}>
                  <label>Valor</label>
                  <MoedaInput name="valor" required />
                </div>
              </div>
              <div className="form-group" style={{ marginBottom: 0 }}>
                <label>Observação (opcional)</label>
                <input name="observacao" type="text" placeholder="Ex.: Pix 21980791811 Cristian Moura" />
              </div>
              <button type="submit" className="btn btn-red self-start">
                Lançar
              </button>
            </form>
          )}

          <div className="kpi-grid mt-4">
            <div className="kpi-card">
              <div className="kpi-label">Total do dia</div>
              <div className="kpi-val">R$ {formatBRLNumber(totalDia)}</div>
            </div>
            <div className="kpi-card">
              <div className="kpi-label">Lançamentos</div>
              <div className="kpi-val">{lancamentos.length}</div>
            </div>
            <div className="kpi-card">
              <div className="kpi-label">Fornecedores</div>
              <div className="kpi-val">{gruposFornecedor.length}</div>
            </div>
          </div>

          {lancamentos.length > 0 && (
            <a
              href={linkWhatsapp}
              target="_blank"
              rel="noopener noreferrer"
              className="btn btn-outline btn-sm mt-4"
            >
              Enviar por WhatsApp
            </a>
          )}

          {gruposFornecedor.length > 0 && (
            <div className="mt-4">
              <div className="sec-header">
                <div className="sec-title">Total por fornecedor</div>
              </div>
              <div className="sec-body" style={{ padding: 0 }}>
                {gruposFornecedor.map((g) => (
                  <div
                    key={g.nome}
                    className="flex items-center justify-between gap-3 border-t border-[var(--border)] px-4 py-2.5 first:border-t-0"
                  >
                    <p className="normal-case text-white">
                      {g.nome} <span className="text-[.7rem] text-[var(--text-muted)]">({g.qtd} lançamento{g.qtd > 1 ? 's' : ''})</span>
                    </p>
                    <p className="font-bold text-white">R$ {formatBRLNumber(g.total)}</p>
                  </div>
                ))}
              </div>
            </div>
          )}

          <div className="mt-4">
            <div className="sec-header">
              <div className="sec-title">Itens lançados</div>
            </div>
            <div className="sec-body" style={{ padding: 0 }}>
              {lancamentos.length === 0 ? (
                <div className="empty-state">Nenhum lançamento nesse dia.</div>
              ) : (
                lancamentos.map((l) => (
                  <div
                    key={l.id}
                    className="flex flex-wrap items-center justify-between gap-3 border-t border-[var(--border)] px-4 py-3 first:border-t-0"
                  >
                    <div>
                      <p className="normal-case text-white">
                        {l.descricao}
                        {l.veiculo_placa ? ` · ${l.veiculo_placa}` : ''}
                      </p>
                      <p className="text-[.72rem] text-[var(--text-muted)]">
                        {l.fornecedor}
                        {l.observacao ? ` · ${l.observacao}` : ''}
                      </p>
                    </div>
                    <div className="flex items-center gap-3">
                      <p className="font-bold text-white">R$ {formatBRLNumber(Number(l.valor))}</p>
                      {podeEditar && (
                        <form action={excluirLancamentoPosVenda}>
                          <input type="hidden" name="id" value={l.id} />
                          <input type="hidden" name="data" value={data} />
                          <ConfirmButton
                            className="text-[.72rem] font-bold text-[var(--danger)] hover:underline"
                            confirmMessage={`Excluir o lançamento "${l.descricao}" (R$ ${formatBRLNumber(Number(l.valor))})?`}
                          >
                            Excluir
                          </ConfirmButton>
                        </form>
                      )}
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      </div>
    </>
  )
}

import Link from 'next/link'
import { notFound } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { Topbar } from '@/components/Topbar'
import { createAtendimento } from '../actions'
import { createLembrete, toggleLembrete } from '@/app/lembretes/actions'
import { origemPresencialLabel, origemDigitalLabel } from '@/lib/atendimentos'
import { ToggleGroup } from '@/components/ToggleGroup'

type LeadDetail = {
  id: string
  nome: string
  observacoes: string | null
  created_at: string
  unidades: { nome: string } | null
  profiles: { nome: string } | null
  contatos: { id: string; tipo: string; valor: string; principal: boolean }[]
  atendimentos: {
    id: string
    tipo: string
    cliente_nome: string | null
    celular: string | null
    veiculo_interesse: string | null
    cv: string | null
    fechou_negocio: boolean | null
    agendou_visita: boolean | null
    origem: string | null
    observacao: string | null
    data_atendimento: string
    profiles: { nome: string } | null
  }[]
  lembretes: {
    id: string
    titulo: string
    data_vencimento: string | null
    concluido: boolean
    categorias: { nome: string; cor: string | null } | null
  }[]
}

type ProfileSummary = { nome: string; cargo: string }

const contatoLabel: Record<string, string> = {
  celular: 'Celular',
  whatsapp: 'WhatsApp',
  email: 'E-mail',
  outro: 'Outro',
}

export default async function LeadDetailPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
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

  const { data: lead } = await supabase
    .from('clientes')
    .select(
      `id, nome, observacoes, created_at,
       unidades(nome), profiles(nome),
       contatos(id, tipo, valor, principal),
       atendimentos(id, tipo, cliente_nome, celular, veiculo_interesse, cv, fechou_negocio, agendou_visita, origem, observacao, data_atendimento, profiles(nome)),
       lembretes(id, titulo, data_vencimento, concluido, categorias(nome, cor))`
    )
    .eq('id', id)
    .order('data_atendimento', { referencedTable: 'atendimentos', ascending: false })
    .order('data_vencimento', { referencedTable: 'lembretes', ascending: true, nullsFirst: false })
    .single<LeadDetail>()

  if (!lead) {
    notFound()
  }

  const { data: categorias } = await supabase.from('categorias').select('id, nome').order('nome')

  return (
    <>
      <Topbar
        nome={profile?.nome ?? user.email ?? ''}
        cargo={profile?.cargo ?? ''}
        isGerencia={isGerencia}
        active="leads"
      />
      <div className="flex flex-1 flex-col gap-4 px-4 py-8 sm:px-10">
        <div className="mx-auto flex w-full max-w-2xl flex-col gap-4">
          <Link href="/leads" className="text-[.72rem] text-[var(--text-muted)] hover:text-white">
            ← Leads
          </Link>

          <div>
            <div className="sec-header">
              <div className="sec-title">{lead.nome}</div>
            </div>
            <div className="sec-body sec-pad">
              <p className="text-[.75rem] text-[var(--text-muted)]">
                {lead.unidades?.nome ?? 'sem unidade'}
                {lead.profiles?.nome ? ` · ${lead.profiles.nome}` : ''} ·{' '}
                {new Date(lead.created_at).toLocaleDateString('pt-BR')}
              </p>

              {lead.observacoes && (
                <p className="mt-3 whitespace-pre-wrap normal-case text-[.85rem] text-white">
                  {lead.observacoes}
                </p>
              )}

              <div className="mt-4 border-t border-[var(--border)] pt-3 text-[.7rem] font-bold tracking-wide text-[var(--red)]">
                Contatos
              </div>
              {lead.contatos.length === 0 ? (
                <p className="mt-2 text-[.8rem] text-[var(--text-muted)]">
                  Nenhum contato cadastrado.
                </p>
              ) : (
                <ul className="mt-2 flex flex-col gap-1">
                  {lead.contatos.map((contato) => (
                    <li key={contato.id} className="text-[.82rem] text-white">
                      {contatoLabel[contato.tipo] ?? contato.tipo}:{' '}
                      <span className="normal-case">{contato.valor}</span>
                      {contato.principal && (
                        <span className="ml-2 text-[.68rem] text-[var(--text-muted)]">
                          (principal)
                        </span>
                      )}
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>

          {/* Atendimentos */}
          <div>
            <div className="sec-header">
              <div className="sec-title">Atendimentos</div>
            </div>
            <div className="sec-body sec-pad">
              {lead.atendimentos.length === 0 ? (
                <p className="text-[.8rem] text-[var(--text-muted)]">
                  Nenhum atendimento registrado.
                </p>
              ) : (
                <ul className="flex flex-col gap-3">
                  {lead.atendimentos.map((atendimento) => {
                    const origemLabel =
                      atendimento.tipo === 'presencial'
                        ? origemPresencialLabel[atendimento.origem ?? '']
                        : origemDigitalLabel[atendimento.origem ?? '']

                    return (
                      <li
                        key={atendimento.id}
                        className="border-b border-[var(--border)] pb-3 last:border-b-0 last:pb-0"
                      >
                        <p className="flex flex-wrap items-center gap-2 text-[.8rem]">
                          <span className="badge badge-enviado">
                            {atendimento.tipo === 'presencial' ? 'Presencial' : 'Digital'}
                          </span>
                          {atendimento.tipo === 'presencial' && atendimento.cv && (
                            <span className="badge badge-pendente">
                              {atendimento.cv === 'compra' ? 'Compra' : 'Venda'}
                            </span>
                          )}
                          {atendimento.tipo === 'presencial' && (
                            <span
                              className={`badge ${atendimento.fechou_negocio ? 'badge-aprovado' : 'badge-rejeitado'}`}
                            >
                              {atendimento.fechou_negocio ? 'Fechou negócio' : 'Não fechou'}
                            </span>
                          )}
                          {atendimento.tipo === 'digital' && (
                            <span
                              className={`badge ${atendimento.agendou_visita ? 'badge-aprovado' : 'badge-rejeitado'}`}
                            >
                              {atendimento.agendou_visita ? 'Agendou visita' : 'Não agendou'}
                            </span>
                          )}
                          <span className="text-[var(--text-muted)]">
                            {new Date(atendimento.data_atendimento).toLocaleString('pt-BR')}
                            {atendimento.profiles?.nome ? ` · ${atendimento.profiles.nome}` : ''}
                          </span>
                        </p>
                        <p className="mt-1 normal-case text-[.82rem] text-white">
                          {atendimento.cliente_nome && <>{atendimento.cliente_nome} · </>}
                          {atendimento.celular && <>{atendimento.celular} · </>}
                          {atendimento.veiculo_interesse && <>{atendimento.veiculo_interesse} · </>}
                          {origemLabel && (
                            <span className="text-[var(--text-muted)]">{origemLabel}</span>
                          )}
                        </p>
                        {atendimento.observacao && (
                          <p className="mt-1 whitespace-pre-wrap normal-case text-[.82rem] text-[var(--text-muted)]">
                            {atendimento.observacao}
                          </p>
                        )}
                      </li>
                    )
                  })}
                </ul>
              )}

              {/* Presencial */}
              <form
                action={createAtendimento}
                className="mt-4 flex flex-col gap-3 border-t border-[var(--border)] pt-4"
              >
                <p className="text-[.7rem] font-bold tracking-wide text-[var(--red)]">
                  Atendimento presencial
                </p>
                <input type="hidden" name="cliente_id" value={lead.id} />
                <input type="hidden" name="tipo" value="presencial" />

                <div className="grid2">
                  <input
                    name="cliente_nome"
                    type="text"
                    placeholder="Nome do cliente"
                    defaultValue={lead.nome}
                  />
                  <input name="celular" type="tel" placeholder="Celular" />
                </div>
                <input name="veiculo_interesse" type="text" placeholder="Veículo de interesse" />

                <div className="flex flex-wrap items-center gap-4">
                  <ToggleGroup
                    name="cv"
                    defaultValue="compra"
                    options={[
                      { value: 'compra', label: 'Compra' },
                      { value: 'venda', label: 'Venda' },
                    ]}
                  />
                  <ToggleGroup
                    name="fechou_negocio"
                    defaultValue="nao"
                    options={[
                      { value: 'sim', label: 'Fechou? Sim' },
                      { value: 'nao', label: 'Fechou? Não' },
                    ]}
                  />
                </div>

                <ToggleGroup
                  name="origem"
                  defaultValue="porta"
                  options={Object.entries(origemPresencialLabel).map(([value, label]) => ({
                    value,
                    label,
                  }))}
                />

                <textarea name="observacao" placeholder="Observação" rows={2} />

                <button type="submit" className="btn btn-red btn-sm self-start">
                  Registrar atendimento presencial
                </button>
              </form>

              {/* Digital */}
              <form
                action={createAtendimento}
                className="mt-4 flex flex-col gap-3 border-t border-[var(--border)] pt-4"
              >
                <p className="text-[.7rem] font-bold tracking-wide text-[var(--red)]">
                  Atendimento digital
                </p>
                <input type="hidden" name="cliente_id" value={lead.id} />
                <input type="hidden" name="tipo" value="digital" />

                <div className="grid2">
                  <input
                    name="cliente_nome"
                    type="text"
                    placeholder="Nome do cliente"
                    defaultValue={lead.nome}
                  />
                  <input name="celular" type="text" placeholder="Celular / canal" />
                </div>
                <input name="veiculo_interesse" type="text" placeholder="Veículo de interesse" />

                <ToggleGroup
                  name="agendou_visita"
                  defaultValue="nao"
                  options={[
                    { value: 'sim', label: 'Agendou visita? Sim' },
                    { value: 'nao', label: 'Agendou visita? Não' },
                  ]}
                />

                <ToggleGroup
                  name="origem"
                  defaultValue="whatsapp"
                  options={Object.entries(origemDigitalLabel).map(([value, label]) => ({
                    value,
                    label,
                  }))}
                />

                <textarea name="observacao" placeholder="Observação" rows={2} />

                <button type="submit" className="btn btn-red btn-sm self-start">
                  Registrar atendimento digital
                </button>
              </form>
            </div>
          </div>

          {/* Lembretes */}
          <div>
            <div className="sec-header">
              <div className="sec-title">Lembretes</div>
            </div>
            <div className="sec-body sec-pad">
              {lead.lembretes.length === 0 ? (
                <p className="text-[.8rem] text-[var(--text-muted)]">
                  Nenhum lembrete para este lead.
                </p>
              ) : (
                <ul className="flex flex-col gap-2">
                  {lead.lembretes.map((lembrete) => (
                    <li key={lembrete.id} className="flex flex-wrap items-center gap-2 text-[.8rem]">
                      <form action={toggleLembrete}>
                        <input type="hidden" name="id" value={lembrete.id} />
                        <input type="hidden" name="concluido" value={String(lembrete.concluido)} />
                        <input type="hidden" name="cliente_id" value={lead.id} />
                        <button
                          type="submit"
                          aria-label={lembrete.concluido ? 'Reabrir lembrete' : 'Concluir lembrete'}
                          className={`flex h-5 w-5 items-center justify-center rounded-full border text-[10px] ${
                            lembrete.concluido
                              ? 'border-emerald-500 bg-emerald-500 text-white'
                              : 'border-[var(--border)] text-transparent hover:border-white'
                          }`}
                        >
                          ✓
                        </button>
                      </form>
                      <span
                        className={
                          lembrete.concluido
                            ? 'normal-case text-[var(--text-muted)] line-through'
                            : 'normal-case text-white'
                        }
                      >
                        {lembrete.titulo}
                      </span>
                      {lembrete.categorias && (
                        <span className="inline-flex items-center gap-1 text-[.68rem] text-[var(--text-muted)]">
                          <span
                            className="h-2 w-2 rounded-full"
                            style={{ backgroundColor: lembrete.categorias.cor ?? '#71717a' }}
                          />
                          {lembrete.categorias.nome}
                        </span>
                      )}
                      {lembrete.data_vencimento && (
                        <span className="text-[.68rem] text-[var(--text-muted)]">
                          vence {new Date(lembrete.data_vencimento).toLocaleDateString('pt-BR')}
                        </span>
                      )}
                    </li>
                  ))}
                </ul>
              )}

              <form action={createLembrete} className="mt-4 flex flex-col gap-3">
                <input type="hidden" name="cliente_id" value={lead.id} />
                <div className="flex flex-wrap gap-3">
                  <input
                    name="titulo"
                    type="text"
                    required
                    placeholder="Título do lembrete"
                    className="flex-1"
                  />
                  <select name="categoria_id" defaultValue="" className="max-w-[160px]">
                    <option value="">Sem categoria</option>
                    {categorias?.map((categoria) => (
                      <option key={categoria.id} value={categoria.id}>
                        {categoria.nome}
                      </option>
                    ))}
                  </select>
                  <input name="data_vencimento" type="date" className="max-w-[160px]" />
                </div>
                <button type="submit" className="btn btn-red btn-sm self-start">
                  Adicionar lembrete
                </button>
              </form>
            </div>
          </div>
        </div>
      </div>
    </>
  )
}

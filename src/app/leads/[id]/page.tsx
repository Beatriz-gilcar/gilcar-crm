import Link from 'next/link'
import { notFound } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { createAtendimento } from '../actions'
import { createLembrete, toggleLembrete } from '@/app/lembretes/actions'

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
    descricao: string | null
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

const contatoLabel: Record<string, string> = {
  celular: 'Celular',
  whatsapp: 'WhatsApp',
  email: 'E-mail',
  outro: 'Outro',
}

const atendimentoLabel: Record<string, string> = {
  digital: 'Digital',
  presencial: 'Presencial',
  compra: 'Compra',
  venda: 'Venda',
}

export default async function LeadDetailPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const supabase = await createClient()

  const { data: lead } = await supabase
    .from('clientes')
    .select(
      `id, nome, observacoes, created_at,
       unidades(nome), profiles(nome),
       contatos(id, tipo, valor, principal),
       atendimentos(id, tipo, descricao, data_atendimento, profiles(nome)),
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
    <div className="flex flex-1 flex-col gap-6 bg-zinc-50 px-4 py-10 dark:bg-black sm:px-10">
      <div className="mx-auto w-full max-w-2xl">
        <Link href="/leads" className="text-sm text-zinc-500 hover:underline dark:text-zinc-400">
          ← Leads
        </Link>

        <div className="mt-2 rounded-xl border border-black/10 bg-white p-8 dark:border-white/10 dark:bg-zinc-950">
          <h1 className="text-xl font-semibold text-black dark:text-zinc-50">{lead.nome}</h1>
          <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
            {lead.unidades?.nome ?? 'sem unidade'}
            {lead.profiles?.nome ? ` · ${lead.profiles.nome}` : ''} ·{' '}
            {new Date(lead.created_at).toLocaleDateString('pt-BR')}
          </p>

          {lead.observacoes && (
            <p className="mt-4 whitespace-pre-wrap text-sm text-zinc-700 dark:text-zinc-300">
              {lead.observacoes}
            </p>
          )}

          <h2 className="mt-6 text-sm font-semibold text-black dark:text-zinc-50">Contatos</h2>
          {lead.contatos.length === 0 ? (
            <p className="mt-2 text-sm text-zinc-500 dark:text-zinc-400">
              Nenhum contato cadastrado.
            </p>
          ) : (
            <ul className="mt-2 flex flex-col gap-1">
              {lead.contatos.map((contato) => (
                <li key={contato.id} className="text-sm text-zinc-700 dark:text-zinc-300">
                  {contatoLabel[contato.tipo] ?? contato.tipo}: {contato.valor}
                  {contato.principal && (
                    <span className="ml-2 text-xs text-zinc-400 dark:text-zinc-500">
                      (principal)
                    </span>
                  )}
                </li>
              ))}
            </ul>
          )}
        </div>

        {/* Atendimentos */}
        <div className="mt-6 rounded-xl border border-black/10 bg-white p-8 dark:border-white/10 dark:bg-zinc-950">
          <h2 className="text-sm font-semibold text-black dark:text-zinc-50">Atendimentos</h2>

          {lead.atendimentos.length === 0 ? (
            <p className="mt-2 text-sm text-zinc-500 dark:text-zinc-400">
              Nenhum atendimento registrado.
            </p>
          ) : (
            <ul className="mt-2 flex flex-col gap-3">
              {lead.atendimentos.map((atendimento) => (
                <li key={atendimento.id} className="text-sm">
                  <p className="text-black dark:text-zinc-50">
                    <span className="font-medium">
                      {atendimentoLabel[atendimento.tipo] ?? atendimento.tipo}
                    </span>{' '}
                    <span className="text-zinc-500 dark:text-zinc-400">
                      · {new Date(atendimento.data_atendimento).toLocaleString('pt-BR')}
                      {atendimento.profiles?.nome ? ` · ${atendimento.profiles.nome}` : ''}
                    </span>
                  </p>
                  {atendimento.descricao && (
                    <p className="mt-1 whitespace-pre-wrap text-zinc-700 dark:text-zinc-300">
                      {atendimento.descricao}
                    </p>
                  )}
                </li>
              ))}
            </ul>
          )}

          <form action={createAtendimento} className="mt-4 flex flex-col gap-3">
            <input type="hidden" name="cliente_id" value={lead.id} />
            <div className="flex gap-3">
              <select
                name="tipo"
                required
                defaultValue=""
                className="rounded-md border border-black/10 bg-transparent px-3 py-2 text-sm text-black dark:border-white/20 dark:text-zinc-50"
              >
                <option value="" disabled>
                  Tipo...
                </option>
                <option value="digital">Digital</option>
                <option value="presencial">Presencial</option>
                <option value="compra">Compra</option>
                <option value="venda">Venda</option>
              </select>
              <input
                name="descricao"
                type="text"
                placeholder="Observações (opcional)"
                className="flex-1 rounded-md border border-black/10 bg-transparent px-3 py-2 text-sm text-black dark:border-white/20 dark:text-zinc-50"
              />
            </div>
            <button
              type="submit"
              className="self-start rounded-full bg-foreground px-4 py-1.5 text-sm font-medium text-background hover:bg-[#383838] dark:hover:bg-[#ccc]"
            >
              Registrar atendimento
            </button>
          </form>
        </div>

        {/* Lembretes */}
        <div className="mt-6 rounded-xl border border-black/10 bg-white p-8 dark:border-white/10 dark:bg-zinc-950">
          <h2 className="text-sm font-semibold text-black dark:text-zinc-50">Lembretes</h2>

          {lead.lembretes.length === 0 ? (
            <p className="mt-2 text-sm text-zinc-500 dark:text-zinc-400">
              Nenhum lembrete para este lead.
            </p>
          ) : (
            <ul className="mt-2 flex flex-col gap-2">
              {lead.lembretes.map((lembrete) => (
                <li key={lembrete.id} className="flex items-center gap-3 text-sm">
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
                          : 'border-black/20 text-transparent hover:border-black/40 dark:border-white/30'
                      }`}
                    >
                      ✓
                    </button>
                  </form>
                  <span
                    className={
                      lembrete.concluido
                        ? 'text-zinc-400 line-through dark:text-zinc-500'
                        : 'text-black dark:text-zinc-50'
                    }
                  >
                    {lembrete.titulo}
                  </span>
                  {lembrete.categorias && (
                    <span className="inline-flex items-center gap-1 text-xs text-zinc-500 dark:text-zinc-400">
                      <span
                        className="h-2 w-2 rounded-full"
                        style={{ backgroundColor: lembrete.categorias.cor ?? '#71717a' }}
                      />
                      {lembrete.categorias.nome}
                    </span>
                  )}
                  {lembrete.data_vencimento && (
                    <span className="text-xs text-zinc-400 dark:text-zinc-500">
                      vence {new Date(lembrete.data_vencimento).toLocaleDateString('pt-BR')}
                    </span>
                  )}
                </li>
              ))}
            </ul>
          )}

          <form action={createLembrete} className="mt-4 flex flex-col gap-3">
            <input type="hidden" name="cliente_id" value={lead.id} />
            <div className="flex gap-3">
              <input
                name="titulo"
                type="text"
                required
                placeholder="Título do lembrete"
                className="flex-1 rounded-md border border-black/10 bg-transparent px-3 py-2 text-sm text-black dark:border-white/20 dark:text-zinc-50"
              />
              <select
                name="categoria_id"
                defaultValue=""
                className="rounded-md border border-black/10 bg-transparent px-3 py-2 text-sm text-black dark:border-white/20 dark:text-zinc-50"
              >
                <option value="">Sem categoria</option>
                {categorias?.map((categoria) => (
                  <option key={categoria.id} value={categoria.id}>
                    {categoria.nome}
                  </option>
                ))}
              </select>
              <input
                name="data_vencimento"
                type="date"
                className="rounded-md border border-black/10 bg-transparent px-3 py-2 text-sm text-black dark:border-white/20 dark:text-zinc-50"
              />
            </div>
            <button
              type="submit"
              className="self-start rounded-full bg-foreground px-4 py-1.5 text-sm font-medium text-background hover:bg-[#383838] dark:hover:bg-[#ccc]"
            >
              Adicionar lembrete
            </button>
          </form>
        </div>
      </div>
    </div>
  )
}

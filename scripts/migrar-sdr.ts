/**
 * Migração das planilhas antigas de SDR (uma por pessoa: Andressa, Beatriz,
 * Larissa, Raquel, Thuane, Vitória, Yasmin) pro banco novo (Supabase).
 *
 * Cada linha da planilha é UM lead individual (cliente, loja, consultor,
 * se compareceu). O sistema novo guarda TOTAIS por dia/consultor/SDR
 * (sdr_leads) e total de leads recebidos por dia/SDR (sdr_dia) — então este
 * script agrega as linhas antes de gravar.
 *
 * Decisões combinadas com a Beatriz antes de escrever isso:
 *   - "GUARATIBA" (planilha antiga) = unidade "Mato Alto" hoje.
 *   - "CAMPO GRANDE" (planilha antiga) = unidade "Cachamorra" hoje.
 *   - A data que conta é a de quando o LEAD CHEGOU, não a da visita agendada.
 *   - Consultor sem cadastro atual (ex-funcionário): cria perfil inativo
 *     (ativo=false, visivel_sdr_mesmo_inativo=true — mesmo padrão já usado
 *     pro "Lucas"), pra não perder o histórico.
 *   - Nomes parciais (JOSÉ, LEONARDO, JEFERSON, ...) que batem com alguém
 *     que hoje é supervisor/gerente: conta como a mesma pessoa.
 *   - A planilha "BEATRIZ" é a própria Beatriz (hoje admin).
 *
 * Uso:
 *   npx tsx scripts/migrar-sdr.ts --dry-run   (só mostra o que faria)
 *   npx tsx scripts/migrar-sdr.ts             (roda de verdade)
 */
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { parse } from 'csv-parse/sync'
import { createClient } from '@supabase/supabase-js'

const DRY_RUN = process.argv.includes('--dry-run')
const CSV_DIR = 'C:\\Users\\Beatriz Navarro\\Desktop\\sdr'

// ── Setup ────────────────────────────────────────────────────────────────

function carregarEnvLocal() {
  const envPath = join(__dirname, '..', '.env.local')
  const raw = readFileSync(envPath, 'utf-8')
  for (const linha of raw.split('\n')) {
    const m = linha.match(/^([A-Z_]+)=(.*)$/)
    if (m) process.env[m[1]] = m[2].trim()
  }
}
carregarEnvLocal()

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SECRET_KEY!, {
  auth: { autoRefreshToken: false, persistSession: false },
})

// ── Helpers de texto/data ────────────────────────────────────────────────

function normalizar(s: string): string {
  return s
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toUpperCase()
    .trim()
    .replace(/\s+/g, ' ')
}

function tituloCase(s: string): string {
  return s
    .toLowerCase()
    .split(' ')
    .map((p) => (p ? p[0].toUpperCase() + p.slice(1) : p))
    .join(' ')
}

// dd/mm/aaaa -> aaaa-mm-dd. Corrige o único caso torto encontrado na
// planilha da Raquel ("17/07/20025", ano com 5 dígitos). Datas com ano fora
// do período em que a empresa opera (erro de digitação tipo "0202"/"2028")
// voltam null e a linha é descartada — ver ANO_MIN/ANO_MAX.
const ANO_MIN = 2025
const ANO_MAX = 2026

function dataBRParaISO(raw: string): string | null {
  const s = raw.trim()
  const m = s.match(/^(\d{2})\/(\d{2})\/(\d{4,5})$/)
  if (!m) return null
  const [, dd, mm, anoRaw] = m
  const ano = anoRaw.length === 5 ? anoRaw.slice(0, 4) : anoRaw
  const anoNum = Number(ano)
  if (anoNum < ANO_MIN || anoNum > ANO_MAX) return null
  return `${ano}-${mm}-${dd}`
}

// ── Leitura posicional dos CSVs ──────────────────────────────────────────
// O cabeçalho varia de nome entre arquivos (DIA/DATA/AGENDAMENTO trocados),
// mas a ORDEM das colunas é sempre a mesma:
// MÊS, DATA_LEAD, NOME, TEL, MOTIVO, VEÍCULO, DATA_VISITA, HORA, LOJA,
// CONSULTOR, [ORIGEM opcional], OBSERVAÇÃO, VISITA, FEEDBACK, VENDAS/FECHOU

type LeadBruto = {
  arquivo: string
  dataLeadISO: string
  loja: string
  consultorBruto: string
  temAgendamento: boolean
  compareceu: boolean
}

const linhasIgnoradas: { arquivo: string; motivo: string }[] = []

function lerLeads(nomeArquivo: string): LeadBruto[] {
  const raw = readFileSync(join(CSV_DIR, nomeArquivo), 'utf-8')
  const rows: string[][] = parse(raw, { columns: false, skip_empty_lines: true, relax_column_count: true })
  const header = rows[0]
  const temOrigem = header.some((h) => /ORIGEM/i.test(h))
  const idxLoja = 8
  const idxConsultor = 9
  const idxVisita = temOrigem ? 12 : 11

  const out: LeadBruto[] = []
  for (let i = 1; i < rows.length; i++) {
    const r = rows[i]
    const dataLeadRaw = (r[1] ?? '').trim()
    const dataVisitaRaw = (r[6] ?? '').trim()
    const loja = (r[idxLoja] ?? '').trim()
    const consultorBruto = (r[idxConsultor] ?? '').trim()
    const visita = (r[idxVisita] ?? '').trim().toUpperCase()
    if (!dataLeadRaw && !loja && !consultorBruto) continue // linha em branco do export

    const dataLeadISO = dataBRParaISO(dataLeadRaw)
    if (!dataLeadISO) {
      linhasIgnoradas.push({ arquivo: nomeArquivo, motivo: `data inválida/implausível: "${dataLeadRaw}"` })
      continue
    }
    if (!consultorBruto) {
      linhasIgnoradas.push({ arquivo: nomeArquivo, motivo: 'sem nome de consultor' })
      continue
    }

    const compareceu = visita === 'SIM'
    // Quem compareceu teve agendamento, mesmo nas poucas linhas em que a
    // planilha original deixou a data da visita em branco (ex.: Raquel).
    const temAgendamento = dataBRParaISO(dataVisitaRaw) !== null || compareceu

    out.push({
      arquivo: nomeArquivo,
      dataLeadISO,
      loja: normalizar(loja),
      consultorBruto,
      temAgendamento,
      compareceu,
    })
  }
  return out
}

// ── Mapa de lojas antigas -> unidade atual ──────────────────────────────
const LOJA_PARA_UNIDADE: Record<string, string> = {
  'GUARATIBA': 'Mato Alto',
  'CAMPO GRANDE': 'Cachamorra',
  'SANTA CRUZ': 'Santa Cruz',
  'RECREIO': 'Recreio',
}

// ── Arquivo -> quem é a SDR autora ───────────────────────────────────────
// nomeAtual: nome exato do perfil já existente. criarComo: se não existir,
// cria um perfil placeholder com esse nome (cargo sdr, inativo).
const ARQUIVOS: { arquivo: string; nomeAtual?: string; criarComo?: string }[] = [
  { arquivo: 'AGENDAMENTO- Gilcar - ANDRESSA.csv', nomeAtual: 'Andressa' },
  { arquivo: 'AGENDAMENTO- Gilcar - BEATRIZ .csv', nomeAtual: 'Beatriz' },
  { arquivo: 'AGENDAMENTO- Gilcar - LARISSA.csv', nomeAtual: 'Larissa' },
  { arquivo: 'AGENDAMENTO- Gilcar - RAQUEL.csv', criarComo: 'Raquel' },
  { arquivo: 'AGENDAMENTO- Gilcar - THUANE.csv', nomeAtual: 'Thuane' },
  { arquivo: 'AGENDAMENTO- Gilcar - VITÓRIA.csv', nomeAtual: 'Vitória' },
  { arquivo: 'AGENDAMENTO- Gilcar - YASMIN.csv', criarComo: 'Yasmin' },
]

// ── Aliases de nome de consultor confirmados (nome normalizado -> nome
// exato do perfil já cadastrado) ─────────────────────────────────────────
const ALIAS_CONSULTOR: Record<string, string> = {
  'JOSE': 'José Santos',
  'JOAO': 'João Junqueira',
  'LEONARDO': 'Leonardo Rocha',
  'JEFERSON': 'Jefferson Fernandes',
  'GABRIEL': 'Gabriel Gimenez',
  'GIMENES': 'Gabriel Gimenez',
  'BEATRIZ': 'Beatriz Veiga',
  'L FERNANDO': 'Luiz Fernando',
  'LUIZ FERNANDO': 'Luiz Fernando',
  'PEDRO': 'Pedro Alexandre',
  'PEDRO A': 'Pedro Alexandre',
  'TAYNARA': 'Taynara',
  'THAYNARA': 'Taynara',
  'LUIS': 'Luis Scari',
  'FERNANDO': 'Fernando Costa',
  'PABLO': 'Pablo Adriano',
  'LUCAS': 'Lucas',
  'HYAGO': 'Hyago',
  'BRENDA': 'Brenda',
  'BRUNO': 'Bruno',
  'LUCIANA': 'Luciana',
}

type Profile = { id: string; nome: string; cargo: string; ativo: boolean; unidade_id: string | null }

async function main() {
  console.log(DRY_RUN ? '=== DRY RUN (nada será gravado) ===\n' : '=== RODANDO DE VERDADE ===\n')

  const { data: unidadesData, error: eu } = await supabase.from('unidades').select('id, nome')
  if (eu) throw eu
  const unidadeIdPorNome = new Map((unidadesData ?? []).map((u) => [u.nome, u.id]))

  const { data: profilesData, error: ep } = await supabase
    .from('profiles')
    .select('id, nome, cargo, ativo, unidade_id')
  if (ep) throw ep
  const profiles = (profilesData ?? []) as Profile[]

  // Prefere sempre o perfil ATIVO quando há duplicata de nome (ex.: 2x "Luis Scari").
  function porNomeExato(nome: string): Profile | undefined {
    const candidatos = profiles.filter((p) => normalizar(p.nome) === normalizar(nome))
    return candidatos.find((p) => p.ativo) ?? candidatos[0]
  }

  // ── 1ª passada: lê tudo, decide loja predominante de cada nome não resolvido ──
  const todasLinhas = ARQUIVOS.flatMap((a) => lerLeads(a.arquivo).map((l) => ({ ...l, cfgArquivo: a })))
  console.log(`Total de leads lidos das 7 planilhas: ${todasLinhas.length}`)
  console.log(`Linhas ignoradas (data inválida ou sem consultor): ${linhasIgnoradas.length}`)
  for (const ig of linhasIgnoradas) console.log(`  ${ig.arquivo} — ${ig.motivo}`)

  const consultorResolvidoCache = new Map<string, Profile | 'CRIAR'>()

  // Só resolve (com cache) — não conta nada. A contagem por loja é feita à
  // parte, pra todo mundo, senão o cache faz a tally rodar uma vez só.
  function resolverConsultor(nomeBruto: string): Profile | 'CRIAR' {
    const chave = normalizar(nomeBruto)
    if (consultorResolvidoCache.has(chave)) return consultorResolvidoCache.get(chave)!
    const alias = ALIAS_CONSULTOR[chave]
    const achado = alias ? porNomeExato(alias) : porNomeExato(nomeBruto)
    const resultado = achado ?? 'CRIAR'
    consultorResolvidoCache.set(chave, resultado)
    return resultado
  }

  const lojaPorNomeNaoResolvido = new Map<string, Map<string, number>>()
  for (const l of todasLinhas) {
    if (resolverConsultor(l.consultorBruto) !== 'CRIAR') continue
    const chave = normalizar(l.consultorBruto)
    if (!lojaPorNomeNaoResolvido.has(chave)) lojaPorNomeNaoResolvido.set(chave, new Map())
    const porLoja = lojaPorNomeNaoResolvido.get(chave)!
    porLoja.set(l.loja, (porLoja.get(l.loja) ?? 0) + 1)
  }

  // Nomes que vão virar perfil novo (inativo) + a loja mais comum pra cada um.
  const novosConsultores = [...lojaPorNomeNaoResolvido.entries()].map(([chave, porLoja]) => {
    const lojaTop = [...porLoja.entries()].sort((a, b) => b[1] - a[1])[0][0]
    const totalLinhas = [...porLoja.values()].reduce((a, b) => a + b, 0)
    // Pega a grafia original (não normalizada) mais frequente pra exibir/nomear.
    const original = todasLinhas.find((l) => normalizar(l.consultorBruto) === chave)!.consultorBruto
    return { chave, nomeExibicao: tituloCase(original), lojaAntiga: lojaTop, unidadeNome: LOJA_PARA_UNIDADE[lojaTop] ?? null, totalLinhas }
  })

  console.log(`\nConsultores sem cadastro atual (vão virar perfil inativo): ${novosConsultores.length}`)
  for (const c of novosConsultores.sort((a, b) => b.totalLinhas - a.totalLinhas)) {
    console.log(`  ${c.nomeExibicao.padEnd(20)} ${String(c.totalLinhas).padStart(4)} linhas  -> unidade: ${c.unidadeNome ?? '??? (loja "' + c.lojaAntiga + '" não mapeada)'}`)
  }

  // SDRs autoras que também precisam de perfil novo (Raquel, Yasmin).
  const sdrsNovas = ARQUIVOS.filter((a) => a.criarComo)
  console.log(`\nSDRs autoras sem cadastro atual (vão virar perfil inativo): ${sdrsNovas.map((a) => a.criarComo).join(', ') || '(nenhuma)'}`)

  // SDRs/consultores existentes usados (conferência rápida).
  for (const a of ARQUIVOS) {
    if (!a.nomeAtual) continue
    const p = porNomeExato(a.nomeAtual)
    console.log(`  arquivo ${a.arquivo} -> perfil "${a.nomeAtual}": ${p ? 'OK (' + p.cargo + ')' : 'NÃO ENCONTRADO — CONFERIR'}`)
  }

  if (novosConsultores.some((c) => !c.unidadeNome)) {
    console.log('\n⚠ Tem loja antiga não mapeada pra unidade atual — pare e ajuste LOJA_PARA_UNIDADE antes de continuar.')
    process.exit(1)
  }

  if (DRY_RUN) {
    // ── Resumo agregado (sem gravar nada) ──────────────────────────────
    const porMes = new Map<string, number>()
    for (const l of todasLinhas) {
      const mes = l.dataLeadISO.slice(0, 7)
      porMes.set(mes, (porMes.get(mes) ?? 0) + 1)
    }
    console.log('\n=== Leads por mês ===')
    for (const [mes, n] of [...porMes.entries()].sort()) console.log(`  ${mes}: ${n}`)

    const chavesSdrLeads = new Set<string>()
    for (const l of todasLinhas) {
      const cons = resolverConsultor(l.consultorBruto)
      const consId = cons === 'CRIAR' ? `NOVO:${normalizar(l.consultorBruto)}` : cons.id
      const sdrChave = (l as any).cfgArquivo.nomeAtual ?? `NOVO:${(l as any).cfgArquivo.criarComo}`
      chavesSdrLeads.add(`${l.dataLeadISO}|${consId}|${sdrChave}`)
    }
    console.log(`\nLinhas que virarão registros em sdr_leads (dia+consultor+SDR únicos): ${chavesSdrLeads.size}`)
    console.log('\nNada foi gravado (--dry-run). Revise a lista de perfis novos acima antes de rodar sem a flag.')
    return
  }

  // ── Criação dos perfis novos (placeholder, inativos) ────────────────────
  // O e-mail inclui o cargo pra não colidir quando um nome existe nos dois
  // papéis (ex.: "Raquel" consultora de verdade E "Raquel" SDR autora de
  // planilha — pessoas diferentes, mesmo nome).
  function gerarEmailUnico(nome: string, cargo: string): string {
    const slug = normalizar(nome).toLowerCase().replace(/[^a-z0-9]+/g, '.').replace(/^\.+|\.+$/g, '')
    return `${slug}.${cargo}.ex-importado@import.gilcar.local`
  }

  async function criarPerfilPlaceholder(nome: string, cargo: 'consultor' | 'sdr', unidadeNome: string | null): Promise<Profile> {
    const email = gerarEmailUnico(nome, cargo)
    let userId: string

    const senha = `Importado-${Math.random().toString(36).slice(2)}-${Date.now().toString(36)}`
    const { data: created, error: createError } = await supabase.auth.admin.createUser({
      email,
      password: senha,
      email_confirm: true,
      user_metadata: { nome },
    })

    if (created?.user) {
      userId = created.user.id
    } else if (createError?.message.includes('already been registered')) {
      // Retomando de uma tentativa anterior que falhou depois de criar o
      // login mas antes de configurar o perfil — acha o usuário já existente
      // em vez de tentar criar de novo, e conserta os campos dele abaixo.
      const { data: lista, error: listError } = await supabase.auth.admin.listUsers({ perPage: 1000 })
      if (listError) throw new Error(`Falha ao procurar usuário existente de "${nome}": ${listError.message}`)
      const existente = lista.users.find((u) => u.email === email)
      if (!existente) throw new Error(`"${nome}" diz e-mail já registrado, mas não achei o usuário: ${email}`)
      userId = existente.id
      console.log(`  (retomando perfil já criado antes pra "${nome}")`)
    } else {
      throw new Error(`Falha ao criar usuário pra "${nome}": ${createError?.message}`)
    }

    const unidade_id = unidadeNome ? unidadeIdPorNome.get(unidadeNome) ?? null : null
    const { error: profileError } = await supabase
      .from('profiles')
      .update({ nome, cargo, unidade_id, ativo: false, visivel_sdr_mesmo_inativo: true })
      .eq('id', userId)
    if (profileError) throw new Error(`Falha ao configurar perfil de "${nome}": ${profileError.message}`)

    // Bane o login imediatamente — perfil existe só pra manter o histórico.
    await supabase.auth.admin.updateUserById(userId, { ban_duration: '876000h' })

    const novo: Profile = { id: userId, nome, cargo, ativo: false, unidade_id }
    profiles.push(novo)
    console.log(`  + criado perfil inativo "${nome}" (${cargo}, unidade: ${unidadeNome ?? '—'})`)
    return novo
  }

  console.log('\n── Criando perfis placeholder ──')
  const novosConsultorPerfil = new Map<string, Profile>()
  for (const c of novosConsultores) {
    const p = await criarPerfilPlaceholder(c.nomeExibicao, 'consultor', c.unidadeNome)
    novosConsultorPerfil.set(c.chave, p)
  }
  const novosSdrPerfil = new Map<string, Profile>()
  for (const a of sdrsNovas) {
    const p = await criarPerfilPlaceholder(a.criarComo!, 'sdr', null)
    novosSdrPerfil.set(a.arquivo, p)
  }

  function idConsultorFinal(nomeBruto: string): string {
    const r = resolverConsultor(nomeBruto)
    if (r !== 'CRIAR') return r.id
    return novosConsultorPerfil.get(normalizar(nomeBruto))!.id
  }

  function idSdrFinal(cfg: { nomeAtual?: string; criarComo?: string; arquivo: string }): string {
    if (cfg.nomeAtual) return porNomeExato(cfg.nomeAtual)!.id
    return novosSdrPerfil.get(cfg.arquivo)!.id
  }

  // ── Agregação: sdr_leads (dia + consultor + SDR) ────────────────────────
  type Agregado = { consultor_id: string; lancado_por: string; data: string; leads: number; agendamentos: number; comparecimentos: number }
  const agregados = new Map<string, Agregado>()
  const leadsRecebidosPorSdrDia = new Map<string, { sdr_id: string; data: string; total: number }>()

  for (const l of todasLinhas) {
    const cfg = (l as any).cfgArquivo as { nomeAtual?: string; criarComo?: string; arquivo: string }
    const consultor_id = idConsultorFinal(l.consultorBruto)
    const lancado_por = idSdrFinal(cfg)

    const chave = `${l.dataLeadISO}|${consultor_id}|${lancado_por}`
    const atual = agregados.get(chave) ?? { consultor_id, lancado_por, data: l.dataLeadISO, leads: 0, agendamentos: 0, comparecimentos: 0 }
    atual.leads += 1
    if (l.temAgendamento) atual.agendamentos += 1
    if (l.compareceu) atual.comparecimentos += 1
    agregados.set(chave, atual)

    const chaveDia = `${l.dataLeadISO}|${lancado_por}`
    const atualDia = leadsRecebidosPorSdrDia.get(chaveDia) ?? { sdr_id: lancado_por, data: l.dataLeadISO, total: 0 }
    atualDia.total += 1
    leadsRecebidosPorSdrDia.set(chaveDia, atualDia)
  }

  console.log(`\nRegistros de sdr_leads a gravar: ${agregados.size}`)
  console.log(`Registros de sdr_dia a gravar: ${leadsRecebidosPorSdrDia.size}`)

  // ── Grava em lotes ───────────────────────────────────────────────────
  const LOTE = 500
  const listaAgregados = [...agregados.values()]
  for (let i = 0; i < listaAgregados.length; i += LOTE) {
    const lote = listaAgregados.slice(i, i + LOTE).map((a) => ({ ...a, updated_at: new Date().toISOString() }))
    const { error } = await supabase.from('sdr_leads').upsert(lote, { onConflict: 'data,consultor_id,lancado_por' })
    if (error) throw new Error(`Falha ao gravar sdr_leads (lote ${i}): ${error.message}`)
    console.log(`  sdr_leads: ${Math.min(i + LOTE, listaAgregados.length)}/${listaAgregados.length}`)
  }

  const listaDias = [...leadsRecebidosPorSdrDia.values()].map((d) => ({
    data: d.data,
    sdr_id: d.sdr_id,
    leads_recebidos: d.total,
    updated_at: new Date().toISOString(),
  }))
  for (let i = 0; i < listaDias.length; i += LOTE) {
    const lote = listaDias.slice(i, i + LOTE)
    const { error } = await supabase.from('sdr_dia').upsert(lote, { onConflict: 'data,sdr_id' })
    if (error) throw new Error(`Falha ao gravar sdr_dia (lote ${i}): ${error.message}`)
    console.log(`  sdr_dia: ${Math.min(i + LOTE, listaDias.length)}/${listaDias.length}`)
  }

  console.log('\n=== Concluído ===')
}

main().catch((e) => {
  console.error('\n✗ ERRO:', e)
  process.exit(1)
})

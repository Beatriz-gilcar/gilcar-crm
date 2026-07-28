/**
 * Migração dos dados históricos da planilha "TRATOS E COMBINADOS" pro
 * banco novo (Supabase). Lê os CSVs exportados em MIGRACAO_DIR, resolve
 * vendedor/unidade por nome, e insere via service role (bypassa RLS).
 *
 * Idempotente: cada linha de origem vira uma "chave" estável gravada em
 * `migracao_importados`; rodar de novo pula o que já foi importado.
 *
 * Uso:
 *   npx tsx scripts/migrar-dados.ts --dry-run   (só mostra o que faria)
 *   npx tsx scripts/migrar-dados.ts             (roda de verdade)
 */
import { readFileSync, existsSync } from 'node:fs'
import { join } from 'node:path'
import { parse } from 'csv-parse/sync'
import { createClient } from '@supabase/supabase-js'

const DRY_RUN = process.argv.includes('--dry-run')
const MIGRACAO_DIR = 'C:\\Users\\Beatriz Navarro\\Desktop\\Claude-tratos e combinados\\gilcar-crm-migracao'

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

// ── Helpers genéricos ────────────────────────────────────────────────────

function normalizeNome(s: string): string {
  return s
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .trim()
    .replace(/\s+/g, ' ')
}

function parseBRL(s: unknown): number {
  if (typeof s !== 'string' || !s.trim()) return 0
  const cleaned = s.replace(/R\$\s?/g, '').trim().replace(/\./g, '').replace(',', '.')
  const n = parseFloat(cleaned)
  return Number.isFinite(n) ? n : 0
}

function excelSerialToISO(serial: number): string {
  const ms = Date.UTC(1899, 11, 30) + serial * 86400000
  return new Date(ms).toISOString().slice(0, 10)
}

function parseMesOuData(raw: string): string {
  const trimmed = (raw ?? '').trim()
  if (/^\d{4}-\d{2}$/.test(trimmed)) return `${trimmed}-01`
  const n = Number(trimmed)
  if (Number.isFinite(n) && n > 0) return excelSerialToISO(n)
  return new Date().toISOString().slice(0, 10)
}

function parseDataHoraBR(s: string): string {
  const m = (s ?? '').trim().match(/^(\d{2})\/(\d{2})\/(\d{4})\s+(\d{2}):(\d{2}):(\d{2})$/)
  if (!m) return new Date().toISOString()
  const [, dd, mm, yyyy, hh, mi, ss] = m
  return `${yyyy}-${mm}-${dd}T${hh}:${mi}:${ss}Z`
}

function lerCsvComColunas(nomeArquivo: string): Record<string, string>[] {
  const caminho = join(MIGRACAO_DIR, nomeArquivo)
  if (!existsSync(caminho)) {
    console.warn(`  ⚠ arquivo não encontrado, pulando: ${nomeArquivo}`)
    return []
  }
  const raw = readFileSync(caminho, 'utf-8')
  if (!raw.trim()) return []
  return parse(raw, { columns: true, skip_empty_lines: true, relax_column_count: true })
}

function lerCsvBruto(nomeArquivo: string): string[][] {
  const caminho = join(MIGRACAO_DIR, nomeArquivo)
  if (!existsSync(caminho)) {
    console.warn(`  ⚠ arquivo não encontrado, pulando: ${nomeArquivo}`)
    return []
  }
  const raw = readFileSync(caminho, 'utf-8')
  if (!raw.trim()) return []
  return parse(raw, { columns: false, skip_empty_lines: true, relax_column_count: true })
}

// ── Relatório ────────────────────────────────────────────────────────────

const relatorio = {
  inseridos: {} as Record<string, number>,
  pulados: {} as Record<string, number>,
  naoResolvidos: new Set<string>(),
}

function contar(mapa: Record<string, number>, chave: string, n = 1) {
  mapa[chave] = (mapa[chave] ?? 0) + n
}

// ── Idempotência ─────────────────────────────────────────────────────────

const jaImportadas = new Set<string>()

async function carregarJaImportadas() {
  const { data, error } = await supabase.from('migracao_importados').select('chave')
  if (error) throw error
  for (const r of data ?? []) jaImportadas.add(r.chave)
  console.log(`Registros já importados anteriormente: ${jaImportadas.size}`)
}

async function marcarImportado(chave: string, tabela: string, registroId: string | null) {
  jaImportadas.add(chave)
  if (DRY_RUN) return
  const { error } = await supabase.from('migracao_importados').insert({ chave, tabela, registro_id: registroId })
  if (error) console.error(`  ✗ falha ao marcar chave "${chave}" como importada:`, error.message)
}

// ── Lookups: unidades, equipe, profiles ─────────────────────────────────

const unidadeIdPorNome = new Map<string, string>()
const equipeEmailPorNome = new Map<string, string>()
const authUserIdPorEmail = new Map<string, string>()
const profilePorId = new Map<string, { nome: string; cargo: string; unidade_id: string | null }>()

async function carregarLookups() {
  const { data: unidades, error: errU } = await supabase.from('unidades').select('id, nome')
  if (errU) throw errU
  for (const u of unidades ?? []) unidadeIdPorNome.set(normalizeNome(u.nome), u.id)

  const equipeRows = lerCsvComColunas('Equipes.csv')
  for (const row of equipeRows) {
    const nome = row['Nome']?.trim()
    const email = row['E-mail']?.trim().toLowerCase()
    if (nome && email) equipeEmailPorNome.set(normalizeNome(nome), email)
  }

  const { data: authData, error: errAuth } = await supabase.auth.admin.listUsers({ perPage: 200 })
  if (errAuth) throw errAuth
  for (const u of authData.users) {
    if (u.email) authUserIdPorEmail.set(u.email.toLowerCase().trim(), u.id)
  }

  const { data: profiles, error: errP } = await supabase.from('profiles').select('id, nome, cargo, unidade_id')
  if (errP) throw errP
  for (const p of profiles ?? []) profilePorId.set(p.id, p)

  console.log(
    `Lookups carregados: ${unidadeIdPorNome.size} unidades, ${equipeEmailPorNome.size} membros na planilha, ${authUserIdPorEmail.size} contas reais, ${profilePorId.size} perfis`
  )
}

function resolveUnidade(nomeRaw: string | undefined | null): string | null {
  if (!nomeRaw) return null
  return unidadeIdPorNome.get(normalizeNome(nomeRaw)) ?? null
}

function resolveVendedor(nomeRaw: string | undefined | null): { id: string; unidadeId: string | null } | null {
  if (!nomeRaw?.trim()) return null
  const norm = normalizeNome(nomeRaw)

  let email = equipeEmailPorNome.get(norm)
  if (!email) {
    for (const [nomeEquipe, e] of equipeEmailPorNome) {
      if (nomeEquipe.startsWith(norm) || norm.startsWith(nomeEquipe)) {
        email = e
        break
      }
    }
  }
  if (!email) {
    relatorio.naoResolvidos.add(`vendedor "${nomeRaw}" não encontrado na aba Equipes`)
    return null
  }

  const userId = authUserIdPorEmail.get(email)
  if (!userId) {
    relatorio.naoResolvidos.add(`vendedor "${nomeRaw}" (e-mail ${email}) sem conta criada em /admin`)
    return null
  }

  const profile = profilePorId.get(userId)
  return { id: userId, unidadeId: profile?.unidade_id ?? null }
}

function resolveVendedorPorEmail(emailRaw: string | undefined | null): { id: string; unidadeId: string | null } | null {
  const email = emailRaw?.trim().toLowerCase()
  if (!email) return null
  const userId = authUserIdPorEmail.get(email)
  if (!userId) {
    relatorio.naoResolvidos.add(`e-mail "${email}" sem conta criada em /admin`)
    return null
  }
  const profile = profilePorId.get(userId)
  return { id: userId, unidadeId: profile?.unidade_id ?? null }
}

// ── Estoque ──────────────────────────────────────────────────────────────

const cambioMap: Record<string, string> = { automatico: 'automatico', manual: 'manual' }
const statusVeiculoMap: Record<string, string> = {
  disponivel: 'disponivel',
  reservado: 'reservado',
  vendido: 'vendido',
}

function parseSimNao(s: string | undefined): boolean {
  return normalizeNome(s ?? '') === 'sim'
}

function parseSimNaoOuNulo(s: string | undefined): boolean | null {
  const n = normalizeNome(s ?? '')
  if (n === 'sim') return true
  if (n === 'nao') return false
  return null
}

async function migrarEstoque() {
  console.log('\n── Estoque ──')
  const rows = lerCsvComColunas('Estoque.csv')

  // Mantém só a última ocorrência de cada placa não-vazia (a planilha tem
  // linhas duplicadas de edição).
  const ultimaLinhaPorPlaca = new Map<string, number>()
  rows.forEach((row, i) => {
    const placa = row['Placa']?.trim().toUpperCase()
    if (placa) ultimaLinhaPorPlaca.set(placa, i)
  })

  for (let i = 0; i < rows.length; i++) {
    const row = rows[i]
    const placa = row['Placa']?.trim().toUpperCase() || null

    if (placa && ultimaLinhaPorPlaca.get(placa) !== i) {
      contar(relatorio.pulados, 'veiculos (duplicado, mantida a versão mais recente)')
      continue
    }

    const chave = placa ? `estoque:placa:${placa}` : `estoque:linha:${i}:${row['Marca']}:${row['Modelo']}`
    if (jaImportadas.has(chave)) {
      contar(relatorio.pulados, 'veiculos (já importado)')
      continue
    }

    const unidadeId = resolveUnidade(row['Unidade'])
    if (!unidadeId) {
      relatorio.naoResolvidos.add(`estoque linha ${i}: unidade "${row['Unidade']}" não encontrada`)
      contar(relatorio.pulados, 'veiculos (unidade não resolvida)')
      continue
    }

    const cambio = cambioMap[normalizeNome(row['Cambio'] ?? '')] ?? 'manual'
    const status = statusVeiculoMap[normalizeNome(row['Status'] ?? '')] ?? 'disponivel'
    const licenciadoRaw = row['Licenciado']?.trim()
    const licenciado_ate = licenciadoRaw && /^\d{4}$/.test(licenciadoRaw) ? Number(licenciadoRaw) : null

    const registro = {
      marca: row['Marca']?.trim() || 'Não informado',
      modelo: row['Modelo']?.trim() || 'Não informado',
      cambio,
      gnv: parseSimNao(row['GNV']),
      blindado: parseSimNaoOuNulo(row['Blindados']),
      cor: row['Cor']?.trim() || null,
      ano: row['Ano']?.trim() || null,
      placa,
      licenciado_ate,
      no_site: parseSimNao(row['NoSite']),
      status,
      observacao: row['Manutencao']?.trim() || null,
      unidade_id: unidadeId,
    }

    if (DRY_RUN) {
      contar(relatorio.inseridos, 'veiculos')
      await marcarImportado(chave, 'veiculos', null)
      continue
    }

    const { data, error } = await supabase.from('veiculos').insert(registro).select('id').single()
    if (error) {
      relatorio.naoResolvidos.add(`estoque linha ${i} (placa ${placa}): erro ao inserir — ${error.message}`)
      contar(relatorio.pulados, 'veiculos (erro)')
      continue
    }

    await marcarImportado(chave, 'veiculos', data.id)
    contar(relatorio.inseridos, 'veiculos')
  }
}

// ── Ordens de Serviço (a partir de Ordens.csv, cruzado por "venda") ──────

type OrdemInfo = { ordemId: string | null; valor: number; data: string | null; unidadeId: string | null }
const ordemPorNumeroVenda = new Map<string, OrdemInfo>()

const formaPagamentoMap: Record<string, string> = {
  dinheiro: 'dinheiro',
  'cartao de credito': 'cartao_credito',
  'cartao de debito': 'cartao_debito',
  pix: 'pix',
  boleto: 'boleto',
  consorcio: 'consorcio',
  transferencia: 'transferencia',
}

function textoOuNulo(v: unknown): string | null {
  if (typeof v !== 'string') return null
  const t = v.trim()
  return t ? t : null
}

async function migrarOrdens() {
  console.log('\n── Ordens de Serviço ──')
  const rows = lerCsvComColunas('Ordens.csv')

  type Linha = { row: Record<string, string>; json: any; timestamp: string; numeroVenda: string | null }
  const linhas: Linha[] = []

  for (const row of rows) {
    let json: any
    try {
      json = JSON.parse(row['DadosJSON'] || '{}')
    } catch {
      relatorio.naoResolvidos.add(`ordens: JSON inválido na linha "${row['Linha']}"`)
      continue
    }
    linhas.push({
      row,
      json,
      timestamp: row['DataRegistro'] ?? '',
      numeroVenda: json.venda != null && String(json.venda).trim() !== '' ? String(json.venda).trim() : null,
    })
  }

  // Dedup: pra cada número de venda, mantém só a linha com DataRegistro mais recente.
  const grupos = new Map<string, Linha[]>()
  let semNumero = 0
  for (const l of linhas) {
    const chaveGrupo = l.numeroVenda ?? `__sem-numero-${semNumero++}`
    const grupo = grupos.get(chaveGrupo) ?? []
    grupo.push(l)
    grupos.set(chaveGrupo, grupo)
  }

  for (const [numeroVenda, grupo] of grupos) {
    grupo.sort((a, b) => parseDataHoraBR(a.timestamp).localeCompare(parseDataHoraBR(b.timestamp)))
    const ultima = grupo[grupo.length - 1]
    const { json, row } = ultima

    const chave = `ordem:venda:${numeroVenda}`
    if (jaImportadas.has(chave)) {
      contar(relatorio.pulados, 'ordens_servico (já importado)')
      // ainda assim, popula o map pra cruzar com VendasRegistro
      continue
    }

    const vendedor = resolveVendedor(json.vendedor || row['Vendedor'])
    const unidadeId = resolveUnidade(json.unidade || row['Unidade']) ?? vendedor?.unidadeId ?? null

    if (!vendedor || !unidadeId) {
      relatorio.naoResolvidos.add(`ordem (venda ${numeroVenda}): vendedor ou unidade não resolvidos`)
      contar(relatorio.pulados, 'ordens_servico (vendedor/unidade não resolvidos)')
      continue
    }

    const tipo = normalizeNome(json.tipoOperacao ?? 'venda') === 'compra' ? 'compra' : 'venda'

    const valorTotal = parseBRL(json['valor-veiculo'] ?? json.valor)
    const desconto = parseBRL(json['valor-desconto'])

    const temTroca =
      tipo === 'venda' &&
      Boolean(textoOuNulo(json['troca-marca']) || textoOuNulo(json['troca-modelo']) || parseBRL(json['troca-avaliacao']) > 0)
    const trocaAvaliado = temTroca ? parseBRL(json['troca-avaliacao']) : null
    const trocaDivida = temTroca ? parseBRL(json['troca-quitacao']) : null
    const trocaLiquido = temTroca ? (trocaAvaliado ?? 0) - (trocaDivida ?? 0) : null

    const valorFinanciado = parseBRL(json['valor-alienado'])
    const financeira = valorFinanciado > 0 ? textoOuNulo(json.alienado) : null

    const pagamentosBrutos: any[] = Array.isArray(json.pagamentos) ? json.pagamentos : []
    const pagamentos = pagamentosBrutos
      .map((p) => ({ forma: formaPagamentoMap[normalizeNome(p.tipo ?? '')], valor: parseBRL(p.valor) }))
      .filter((p) => p.forma && p.valor > 0)

    const somaPagamentos = pagamentos.reduce((acc, p) => acc + p.valor, 0)
    const faltaReceber = valorTotal - desconto - somaPagamentos - (trocaLiquido ?? 0) - valorFinanciado

    const dataVenda = textoOuNulo(json['data-venda']) ?? parseMesOuData(row['DataRegistro'] ?? '').slice(0, 10)
    const dataEntrega = textoOuNulo(json['data-entrega'])

    const statusBrutoRaw = row[''] ?? row['Status'] ?? ''
    const statusNorm = normalizeNome(statusBrutoRaw)
    const status = statusNorm === 'aprovado' ? 'aprovada' : statusNorm === 'reprovado' ? 'reprovada' : 'pendente'

    const enderecoPartes = [textoOuNulo(json.endereco), textoOuNulo(json.numero) ? `nº ${json.numero}` : null].filter(Boolean)
    const observacaoPartes = [
      textoOuNulo(json.obs),
      textoOuNulo(json.manutencao) ? `Manutenção: ${json.manutencao}` : null,
      parseBRL(json['troca-debitos']) > 0 ? `Débitos da troca: R$ ${json['troca-debitos']}` : null,
    ].filter(Boolean)

    const registro = {
      tipo,
      unidade_id: unidadeId,
      consultor_id: vendedor.id,
      cliente_nome: textoOuNulo(json.comprador) ?? 'Não informado',
      cliente_cpf_cnpj: textoOuNulo(json.cpf),
      cliente_rg: null,
      cliente_endereco: enderecoPartes.length ? enderecoPartes.join(', ') : null,
      cliente_celular: textoOuNulo(json.celular),
      cliente_email: textoOuNulo(json.email),
      veiculo_id: null,
      veiculo_marca: textoOuNulo(json.marca) ?? 'Não informado',
      veiculo_modelo: textoOuNulo(json.modelo) ?? 'Não informado',
      veiculo_ano: textoOuNulo(json.ano),
      veiculo_placa: textoOuNulo(json.placa)?.toUpperCase() ?? null,
      veiculo_cor: textoOuNulo(json.cor),
      valor_total: valorTotal,
      desconto,
      tem_troca: temTroca,
      troca_marca: temTroca ? textoOuNulo(json['troca-marca']) : null,
      troca_modelo: temTroca ? textoOuNulo(json['troca-modelo']) : null,
      troca_ano: temTroca ? textoOuNulo(json['troca-ano']) : null,
      troca_placa: temTroca ? textoOuNulo(json['troca-placa'])?.toUpperCase() ?? null : null,
      troca_valor_avaliado: trocaAvaliado,
      troca_divida: trocaDivida,
      troca_valor_liquido: trocaLiquido,
      valor_financiado: valorFinanciado,
      financeira,
      falta_receber: faltaReceber,
      data_venda: dataVenda,
      data_entrega: dataEntrega,
      status,
      aprovado_por: null,
      aprovado_em: status !== 'pendente' ? parseDataHoraBR(ultima.timestamp) : null,
      motivo_reprovacao: null,
      observacao: observacaoPartes.length ? observacaoPartes.join('\n') : null,
    }

    if (DRY_RUN) {
      ordemPorNumeroVenda.set(numeroVenda, { ordemId: null, valor: valorTotal, data: dataVenda, unidadeId })
      contar(relatorio.inseridos, 'ordens_servico')
      await marcarImportado(chave, 'ordens_servico', null)
      continue
    }

    const { data: ordem, error } = await supabase.from('ordens_servico').insert(registro).select('id').single()
    if (error) {
      relatorio.naoResolvidos.add(`ordem (venda ${numeroVenda}): erro ao inserir — ${error.message}`)
      contar(relatorio.pulados, 'ordens_servico (erro)')
      continue
    }

    if (pagamentos.length > 0) {
      await supabase
        .from('ordens_servico_pagamentos')
        .insert(pagamentos.map((p) => ({ ordem_id: ordem.id, forma: p.forma, valor: p.valor })))
    }

    ordemPorNumeroVenda.set(numeroVenda, { ordemId: ordem.id, valor: valorTotal, data: dataVenda, unidadeId })
    await marcarImportado(chave, 'ordens_servico', ordem.id)
    contar(relatorio.inseridos, 'ordens_servico')
  }
}

// ── Vendas (Corrida da Meta, a partir de VendasRegistro.csv) ────────────

async function migrarVendas() {
  console.log('\n── Vendas (Corrida da Meta) ──')
  const linhas = lerCsvBruto('VendasRegistro.csv')
  if (linhas.length === 0) return

  // pula o cabeçalho
  for (let i = 1; i < linhas.length; i++) {
    const [col0, vendedorRaw, veiculoRaw, numeroRaw, statusRaw] = linhas[i]
    const numero = Number((numeroRaw ?? '').trim())
    if (!Number.isFinite(numero)) continue

    const chave = `venda:numero:${numero}`
    if (jaImportadas.has(chave)) {
      contar(relatorio.pulados, 'vendas (já importado)')
      continue
    }

    const vendedor = resolveVendedor(vendedorRaw)
    if (!vendedor) {
      contar(relatorio.pulados, 'vendas (vendedor não resolvido)')
      continue
    }

    const ordemLigada = ordemPorNumeroVenda.get(String(numero))
    const unidadeId = ordemLigada?.unidadeId ?? vendedor.unidadeId
    if (!unidadeId) {
      relatorio.naoResolvidos.add(`venda #${numero}: sem unidade resolvida`)
      contar(relatorio.pulados, 'vendas (sem unidade)')
      continue
    }

    const veiculoDescricao = (veiculoRaw ?? '').trim() || 'Não informado'
    const veiculoMarca = ordemLigada ? undefined : undefined // placeholder, ver abaixo

    const valor = ordemLigada?.valor ?? 0
    const data = ordemLigada?.data ?? parseMesOuData(col0 ?? '')
    const status = normalizeNome(statusRaw ?? '') === 'caida' ? 'caida' : 'ativa'

    const registro = {
      numero_sequencial: numero,
      consultor_id: vendedor.id,
      unidade_id: unidadeId,
      veiculo_marca: '—',
      veiculo_modelo: veiculoDescricao,
      veiculo_placa: null,
      valor,
      data,
      status,
      observacao: ordemLigada ? null : 'Valor não encontrado na planilha (sem Ordem de Serviço vinculada) — ajustar manualmente.',
    }

    if (DRY_RUN) {
      contar(relatorio.inseridos, 'vendas')
      await marcarImportado(chave, 'vendas', null)
      continue
    }

    const { data: venda, error } = await supabase.from('vendas').insert(registro).select('id').single()
    if (error) {
      relatorio.naoResolvidos.add(`venda #${numero}: erro ao inserir — ${error.message}`)
      contar(relatorio.pulados, 'vendas (erro)')
      continue
    }

    await marcarImportado(chave, 'vendas', venda.id)
    contar(relatorio.inseridos, 'vendas')
  }
}

// ── Clientes + Atendimentos ──────────────────────────────────────────────

const origemPresencialMap: Record<string, string> = {
  porta: 'porta',
  'ag sdr': 'ag_sdr',
  'ag prop': 'ag_proprio',
  'ag proprio': 'ag_proprio',
  indicacao: 'indicacao',
  'indicacao pessoal': 'indicacao',
  retorno: 'retorno',
}
const origemDigitalMap: Record<string, string> = {
  whatsapp: 'whatsapp',
  instagram: 'instagram',
  marketplace: 'marketplace',
  olx: 'olx',
  site: 'site',
  'auto certo': 'outro',
  autocerto: 'outro',
}

const clienteIdPorChave = new Map<string, string>()

async function migrarAtendimentos() {
  console.log('\n── Clientes + Atendimentos ──')
  const rows = lerCsvComColunas('Atendimento.csv')

  for (let i = 0; i < rows.length; i++) {
    const row = rows[i]
    const chaveAtendimento = `atendimento:linha:${i}`
    if (jaImportadas.has(chaveAtendimento)) {
      contar(relatorio.pulados, 'atendimentos (já importado)')
      continue
    }

    const vendedor = resolveVendedor(row['Vendedor'])
    if (!vendedor) {
      contar(relatorio.pulados, 'atendimentos (vendedor não resolvido)')
      continue
    }
    const unidadeId = resolveUnidade(row['Unidade']) ?? vendedor.unidadeId
    if (!unidadeId) {
      relatorio.naoResolvidos.add(`atendimento linha ${i}: sem unidade resolvida`)
      contar(relatorio.pulados, 'atendimentos (sem unidade)')
      continue
    }

    const clienteNome = row['Cliente']?.trim() || 'Não informado'
    const chaveCliente = `cliente:${normalizeNome(clienteNome)}:${normalizeNome(row['Vendedor'] ?? '')}`

    let clienteId = clienteIdPorChave.get(chaveCliente)
    if (!clienteId) {
      if (jaImportadas.has(chaveCliente)) {
        // já foi importado numa execução anterior, mas não temos o id em memória
        // (idempotência garante que não duplicamos; sem o id não dá pra linkar
        // um NOVO atendimento a ele nesta execução — reporta pra revisão manual).
        relatorio.naoResolvidos.add(`cliente "${clienteNome}" (vendedor ${row['Vendedor']}) já existe, mas não foi possível recuperar o id nesta execução`)
        contar(relatorio.pulados, 'atendimentos (cliente já existente, sem id em cache)')
        continue
      }

      let novoClienteId: string
      if (DRY_RUN) {
        novoClienteId = `dry-run-${chaveCliente}`
        contar(relatorio.inseridos, 'clientes')
      } else {
        const { data: cliente, error } = await supabase
          .from('clientes')
          .insert({ nome: clienteNome, unidade_id: unidadeId, consultor_id: vendedor.id })
          .select('id')
          .single()
        if (error) {
          relatorio.naoResolvidos.add(`cliente "${clienteNome}": erro ao inserir — ${error.message}`)
          contar(relatorio.pulados, 'atendimentos (erro ao criar cliente)')
          continue
        }
        novoClienteId = cliente.id
        contar(relatorio.inseridos, 'clientes')
      }
      clienteId = novoClienteId
      clienteIdPorChave.set(chaveCliente, clienteId)
      await marcarImportado(chaveCliente, 'clientes', DRY_RUN ? null : clienteId)
    }

    if (!clienteId) continue

    const tipo = normalizeNome(row['Tipo'] ?? '') === 'digital' ? 'digital' : 'presencial'
    const cvRaw = normalizeNome(row['CV'] ?? '')
    const cv = tipo === 'presencial' ? (cvRaw === 'compra' ? 'compra' : cvRaw === 'venda' ? 'venda' : null) : null
    const fechouSim = normalizeNome(row['Fechou'] ?? '') === 'sim'
    const origemRaw = normalizeNome(row['Origem'] ?? '')
    const origem = tipo === 'presencial' ? origemPresencialMap[origemRaw] ?? null : origemDigitalMap[origemRaw] ?? null

    const registro = {
      cliente_id: clienteId,
      consultor_id: vendedor.id,
      tipo,
      cliente_nome: clienteNome,
      celular: textoOuNulo(row['Celular']),
      veiculo_interesse: textoOuNulo(row['Veículo']),
      cv,
      fechou_negocio: tipo === 'presencial' ? fechouSim : null,
      agendou_visita: tipo === 'digital' ? fechouSim : null,
      origem,
      observacao: textoOuNulo(row['Observação']),
      data_atendimento: `${row['Data']}T12:00:00Z`,
    }

    if (DRY_RUN) {
      contar(relatorio.inseridos, 'atendimentos')
      await marcarImportado(chaveAtendimento, 'atendimentos', null)
      continue
    }

    const { data: atendimento, error } = await supabase.from('atendimentos').insert(registro).select('id').single()
    if (error) {
      relatorio.naoResolvidos.add(`atendimento linha ${i}: erro ao inserir — ${error.message}`)
      contar(relatorio.pulados, 'atendimentos (erro)')
      continue
    }

    await marcarImportado(chaveAtendimento, 'atendimentos', atendimento.id)
    contar(relatorio.inseridos, 'atendimentos')
  }
}

// ── Checklists de Gerência ────────────────────────────────────────────────

async function migrarChecklists() {
  console.log('\n── Checklists de Gerência ──')
  const rows = lerCsvComColunas('Checklists.csv')

  for (const row of rows) {
    const timestamp = row['Timestamp']?.trim()
    const chave = `checklist:timestamp:${timestamp}`
    if (!timestamp || jaImportadas.has(chave)) {
      if (timestamp) contar(relatorio.pulados, 'checklists_gerencia (já importado)')
      continue
    }

    const avaliado = resolveVendedor(row['Gerente'])
    const avaliador = resolveVendedor(row['Supervisor']) ?? avaliado
    if (!avaliado || !avaliador) {
      relatorio.naoResolvidos.add(`checklist ${timestamp}: gerente/supervisor não resolvidos`)
      contar(relatorio.pulados, 'checklists_gerencia (avaliado/avaliador não resolvidos)')
      continue
    }
    const unidadeId = avaliado.unidadeId
    if (!unidadeId) {
      relatorio.naoResolvidos.add(`checklist ${timestamp}: gerente sem unidade`)
      contar(relatorio.pulados, 'checklists_gerencia (sem unidade)')
      continue
    }

    let itensJson: any[]
    try {
      itensJson = JSON.parse(row['Itens JSON'] || '[]')
    } catch {
      relatorio.naoResolvidos.add(`checklist ${timestamp}: JSON de itens inválido`)
      continue
    }

    const totalSim = itensJson.filter((it) => normalizeNome(it.status ?? '') === 'sim').length
    const percentual = itensJson.length > 0 ? Number(((totalSim / itensJson.length) * 100).toFixed(2)) : 0

    const registro = {
      tipo: normalizeNome(row['Tipo'] ?? 'diario'),
      avaliado_id: avaliado.id,
      avaliador_id: avaliador.id,
      unidade_id: unidadeId,
      data: row['Data'],
      percentual_sim: percentual,
      created_at: timestamp,
    }

    if (DRY_RUN) {
      contar(relatorio.inseridos, 'checklists_gerencia')
      await marcarImportado(chave, 'checklists_gerencia', null)
      continue
    }

    const { data: checklist, error } = await supabase.from('checklists_gerencia').insert(registro).select('id').single()
    if (error) {
      relatorio.naoResolvidos.add(`checklist ${timestamp}: erro ao inserir — ${error.message}`)
      contar(relatorio.pulados, 'checklists_gerencia (erro)')
      continue
    }

    const itensParaInserir = itensJson.map((it, idx) => ({
      checklist_id: checklist.id,
      ordem: idx,
      pergunta: it.pergunta ?? `Item ${idx + 1}`,
      resposta: normalizeNome(it.status ?? '') === 'sim',
      observacao: textoOuNulo(it.obs),
    }))
    if (itensParaInserir.length > 0) {
      await supabase.from('checklist_itens').insert(itensParaInserir)
    }

    await marcarImportado(chave, 'checklists_gerencia', checklist.id)
    contar(relatorio.inseridos, 'checklists_gerencia')
  }
}

// ── Aprovações do Dia ────────────────────────────────────────────────────

async function migrarDiasAprovados() {
  console.log('\n── Status do Dia (aprovações) ──')
  const rows = lerCsvComColunas('DiasAprovados.csv')

  for (const row of rows) {
    const unidadeId = resolveUnidade(row['Unidade'])
    const data = row['Data']?.trim()
    if (!unidadeId || !data) {
      relatorio.naoResolvidos.add(`dia aprovado: unidade "${row['Unidade']}" ou data inválida`)
      contar(relatorio.pulados, 'aprovacoes_dia (unidade/data inválida)')
      continue
    }

    const chave = `dia-aprovado:${unidadeId}:${data}`
    if (jaImportadas.has(chave)) {
      contar(relatorio.pulados, 'aprovacoes_dia (já importado)')
      continue
    }

    const aprovador = resolveVendedor(row['AprovadoPor'])

    const registro = {
      unidade_id: unidadeId,
      data,
      status: 'aprovado',
      aprovado_por: aprovador?.id ?? null,
      aprovado_em: parseDataHoraBR(row['DataAprovacao'] ?? ''),
    }

    if (DRY_RUN) {
      contar(relatorio.inseridos, 'aprovacoes_dia')
      await marcarImportado(chave, 'aprovacoes_dia', null)
      continue
    }

    const { data: aprovacao, error } = await supabase.from('aprovacoes_dia').insert(registro).select('id').single()
    if (error) {
      relatorio.naoResolvidos.add(`dia aprovado ${data}/${row['Unidade']}: erro ao inserir — ${error.message}`)
      contar(relatorio.pulados, 'aprovacoes_dia (erro)')
      continue
    }

    await marcarImportado(chave, 'aprovacoes_dia', aprovacao.id)
    contar(relatorio.inseridos, 'aprovacoes_dia')
  }
}

// ── Metas (vendas + proteção) ────────────────────────────────────────────

async function migrarMetasUnidade(nomeArquivo: string, tipo: 'vendas' | 'protecao') {
  const rows = lerCsvComColunas(nomeArquivo)
  for (const row of rows) {
    const unidadeId = resolveUnidade(row['Unidade'])
    const periodo = row['Mes']?.trim()
    const qtd = Number(row['MetaQtd'] ?? row['MetaVendas'] ?? 0)
    if (!unidadeId || !periodo) {
      relatorio.naoResolvidos.add(`meta ${tipo} unidade: "${row['Unidade']}"/"${periodo}" inválida`)
      continue
    }

    const chave = `meta:${tipo}:unidade:${unidadeId}:${periodo}`
    if (jaImportadas.has(chave)) {
      contar(relatorio.pulados, `metas ${tipo} (já importado)`)
      continue
    }

    const registro = { tipo, escopo: 'unidade', unidade_id: unidadeId, consultor_id: null, periodo, valor_meta: qtd, valor_super_meta: null }

    if (DRY_RUN) {
      contar(relatorio.inseridos, `metas ${tipo}`)
      await marcarImportado(chave, 'metas', null)
      continue
    }

    const { data, error } = await supabase.from('metas').insert(registro).select('id').single()
    if (error) {
      relatorio.naoResolvidos.add(`meta ${tipo} unidade ${row['Unidade']}: erro — ${error.message}`)
      continue
    }
    await marcarImportado(chave, 'metas', data.id)
    contar(relatorio.inseridos, `metas ${tipo}`)
  }
}

async function migrarMetasVendedor(nomeArquivo: string, tipo: 'vendas' | 'protecao') {
  const rows = lerCsvComColunas(nomeArquivo)
  for (const row of rows) {
    const vendedor = resolveVendedorPorEmail(row['Email']) ?? resolveVendedor(row['Nome'])
    const periodo = row['Mes']?.trim()
    const qtd = Number(row['MetaQtd'] ?? row['MetaVendas'] ?? 0)
    if (!vendedor || !periodo) {
      relatorio.naoResolvidos.add(`meta ${tipo} vendedor: "${row['Nome']}" (${row['Email']}) não resolvido`)
      continue
    }

    const chave = `meta:${tipo}:consultor:${vendedor.id}:${periodo}`
    if (jaImportadas.has(chave)) {
      contar(relatorio.pulados, `metas ${tipo} (já importado)`)
      continue
    }

    const registro = { tipo, escopo: 'consultor', unidade_id: null, consultor_id: vendedor.id, periodo, valor_meta: qtd, valor_super_meta: null }

    if (DRY_RUN) {
      contar(relatorio.inseridos, `metas ${tipo}`)
      await marcarImportado(chave, 'metas', null)
      continue
    }

    const { data, error } = await supabase.from('metas').insert(registro).select('id').single()
    if (error) {
      relatorio.naoResolvidos.add(`meta ${tipo} vendedor ${row['Nome']}: erro — ${error.message}`)
      continue
    }
    await marcarImportado(chave, 'metas', data.id)
    contar(relatorio.inseridos, `metas ${tipo}`)
  }
}

async function migrarMetas() {
  console.log('\n── Metas ──')
  await migrarMetasUnidade('MetasUnidade.csv', 'vendas')
  await migrarMetasVendedor('MetasUnidVendedor.csv', 'vendas')
  await migrarMetasUnidade('MetasSeguroUnidade.csv', 'protecao')
  await migrarMetasVendedor('MetasSeguroVendedor.csv', 'protecao')
}

// ── Main ─────────────────────────────────────────────────────────────────

async function main() {
  console.log(`Migração de dados — ${DRY_RUN ? 'DRY RUN (nada será gravado)' : 'EXECUÇÃO REAL'}`)
  console.log(`Lendo CSVs de: ${MIGRACAO_DIR}\n`)

  await carregarLookups()
  await carregarJaImportadas()

  await migrarEstoque()
  await migrarOrdens()
  await migrarVendas()
  await migrarAtendimentos()
  await migrarChecklists()
  await migrarDiasAprovados()
  await migrarMetas()

  console.log('\n════════════════════════════════════════')
  console.log('RESUMO')
  console.log('════════════════════════════════════════')
  console.log('\nInseridos:')
  for (const [k, v] of Object.entries(relatorio.inseridos)) console.log(`  ${k}: ${v}`)
  console.log('\nPulados:')
  for (const [k, v] of Object.entries(relatorio.pulados)) console.log(`  ${k}: ${v}`)
  if (relatorio.naoResolvidos.size > 0) {
    console.log(`\nNão resolvidos (${relatorio.naoResolvidos.size}) — revisar manualmente:`)
    for (const msg of relatorio.naoResolvidos) console.log(`  - ${msg}`)
  }
  console.log('\nConcluído.')
}

main().catch((err) => {
  console.error('Falha na migração:', err)
  process.exit(1)
})

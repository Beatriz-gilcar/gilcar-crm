'use client'

import { useState } from 'react'

type OpcaoRow = { key: string; texto: string; correta: boolean }
type PerguntaRow = { key: string; id: string | null; texto: string; opcoes: OpcaoRow[] }

type PerguntaInicial = { id: string; texto: string; opcoes: { id: string; texto: string; correta: boolean }[] }

let contador = 0
function novaKey() {
  contador += 1
  return `nova-${contador}`
}

function opcaoVazia(): OpcaoRow {
  return { key: novaKey(), texto: '', correta: false }
}

function perguntaVazia(): PerguntaRow {
  return { key: novaKey(), id: null, texto: '', opcoes: [opcaoVazia(), opcaoVazia()] }
}

export function EditarModuloTreinamento({
  moduloId,
  titulo: tituloInicial,
  conteudo: conteudoInicial,
  posicao: posicaoInicial,
  ativo: ativoInicial,
  perguntasIniciais,
  action,
}: {
  moduloId: string | null
  titulo: string
  conteudo: string
  posicao: number
  ativo: boolean
  perguntasIniciais: PerguntaInicial[]
  action: (formData: FormData) => void
}) {
  const [titulo, setTitulo] = useState(tituloInicial)
  const [conteudo, setConteudo] = useState(conteudoInicial)
  const [posicao, setPosicao] = useState(posicaoInicial)
  const [ativo, setAtivo] = useState(ativoInicial)
  const [perguntas, setPerguntas] = useState<PerguntaRow[]>(
    perguntasIniciais.length > 0
      ? perguntasIniciais.map((p) => ({
          key: p.id,
          id: p.id,
          texto: p.texto,
          opcoes: p.opcoes.map((o) => ({ key: o.id, texto: o.texto, correta: o.correta })),
        }))
      : [perguntaVazia()]
  )

  function moverPergunta(i: number, dir: -1 | 1) {
    setPerguntas((ps) => {
      const j = i + dir
      if (j < 0 || j >= ps.length) return ps
      const copia = [...ps]
      ;[copia[i], copia[j]] = [copia[j], copia[i]]
      return copia
    })
  }
  function removerPergunta(i: number) {
    setPerguntas((ps) => ps.filter((_, idx) => idx !== i))
  }
  function adicionarPergunta() {
    setPerguntas((ps) => [...ps, perguntaVazia()])
  }
  function setTextoPergunta(i: number, texto: string) {
    setPerguntas((ps) => ps.map((p, idx) => (idx === i ? { ...p, texto } : p)))
  }
  function setTextoOpcao(i: number, j: number, texto: string) {
    setPerguntas((ps) =>
      ps.map((p, idx) =>
        idx === i ? { ...p, opcoes: p.opcoes.map((o, oj) => (oj === j ? { ...o, texto } : o)) } : p
      )
    )
  }
  function marcarCorreta(i: number, j: number) {
    setPerguntas((ps) =>
      ps.map((p, idx) =>
        idx === i ? { ...p, opcoes: p.opcoes.map((o, oj) => ({ ...o, correta: oj === j })) } : p
      )
    )
  }
  function adicionarOpcao(i: number) {
    setPerguntas((ps) => ps.map((p, idx) => (idx === i ? { ...p, opcoes: [...p.opcoes, opcaoVazia()] } : p)))
  }
  function removerOpcao(i: number, j: number) {
    setPerguntas((ps) =>
      ps.map((p, idx) => (idx === i ? { ...p, opcoes: p.opcoes.filter((_, oj) => oj !== j) } : p))
    )
  }

  const payload = perguntas
    .filter((p) => p.texto.trim())
    .map((p) => ({
      id: p.id ?? undefined,
      texto: p.texto.trim(),
      opcoes: p.opcoes
        .filter((o) => o.texto.trim())
        .map((o) => ({ texto: o.texto.trim(), correta: o.correta })),
    }))

  return (
    <form action={action} className="flex flex-col gap-4">
      <input type="hidden" name="modulo_id" value={moduloId ?? ''} />
      <input type="hidden" name="perguntas" value={JSON.stringify(payload)} />

      <div className="form-group" style={{ marginBottom: 0 }}>
        <label>Título</label>
        <input name="titulo" type="text" value={titulo} onChange={(e) => setTitulo(e.target.value)} required />
      </div>

      <div className="grid2">
        <div className="form-group" style={{ marginBottom: 0 }}>
          <label>Posição (ordem de exibição)</label>
          <input
            name="posicao"
            type="number"
            value={posicao}
            onChange={(e) => setPosicao(Number(e.target.value) || 0)}
          />
        </div>
        <label className="flex items-center gap-2 normal-case text-white" style={{ marginTop: 22 }}>
          <input type="checkbox" name="ativo" checked={ativo} onChange={(e) => setAtivo(e.target.checked)} />
          Ativo (aparece pro consultor)
        </label>
      </div>

      <div className="form-group" style={{ marginBottom: 0 }}>
        <label>Conteúdo</label>
        <textarea name="conteudo" rows={6} value={conteudo} onChange={(e) => setConteudo(e.target.value)} />
      </div>

      <div>
        <div className="sec-header">
          <div className="sec-title">Perguntas do quiz</div>
        </div>
        <div className="flex flex-col gap-3">
          {perguntas.map((p, i) => (
            <div key={p.key} className="card sec-pad flex flex-col gap-2">
              <div className="flex items-start gap-2">
                <div className="flex flex-col">
                  <button
                    type="button"
                    onClick={() => moverPergunta(i, -1)}
                    className="text-[.6rem] leading-none text-[var(--text-muted)] hover:text-white"
                    aria-label="Subir"
                  >
                    ▲
                  </button>
                  <button
                    type="button"
                    onClick={() => moverPergunta(i, 1)}
                    className="text-[.6rem] leading-none text-[var(--text-muted)] hover:text-white"
                    aria-label="Descer"
                  >
                    ▼
                  </button>
                </div>
                <textarea
                  value={p.texto}
                  onChange={(e) => setTextoPergunta(i, e.target.value)}
                  placeholder={`Pergunta ${i + 1}`}
                  rows={2}
                  style={{ flex: 1 }}
                />
                <button
                  type="button"
                  onClick={() => removerPergunta(i)}
                  className="text-[.9rem] font-bold text-[var(--danger)] hover:opacity-80"
                  aria-label="Remover pergunta"
                >
                  ✕
                </button>
              </div>

              <div className="ml-5 flex flex-col gap-1.5">
                {p.opcoes.map((o, j) => (
                  <div key={o.key} className="flex items-center gap-2">
                    <input
                      type="radio"
                      name={`correta-${p.key}`}
                      checked={o.correta}
                      onChange={() => marcarCorreta(i, j)}
                      title="Marcar como a resposta certa"
                    />
                    <input
                      type="text"
                      value={o.texto}
                      onChange={(e) => setTextoOpcao(i, j, e.target.value)}
                      placeholder={`Opção ${j + 1}`}
                      style={{ flex: 1 }}
                    />
                    <button
                      type="button"
                      onClick={() => removerOpcao(i, j)}
                      className="text-[.8rem] font-bold text-[var(--danger)] hover:opacity-80"
                      aria-label="Remover opção"
                    >
                      ✕
                    </button>
                  </div>
                ))}
                <button
                  type="button"
                  onClick={() => adicionarOpcao(i)}
                  className="self-start text-[.68rem] font-bold text-[var(--coral)] hover:underline"
                >
                  + Adicionar opção
                </button>
              </div>
            </div>
          ))}
        </div>
        <button type="button" onClick={adicionarPergunta} className="btn btn-outline btn-sm mt-3">
          + Adicionar pergunta
        </button>
      </div>

      <button type="submit" className="btn btn-red self-start">
        Salvar módulo
      </button>
    </form>
  )
}

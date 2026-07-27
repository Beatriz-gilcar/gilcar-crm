import { metaColor } from '@/lib/metas'

export function MetaWidget({
  titulo,
  subtitulo,
  realizadoLabel,
  metaLabel,
  pct,
  // Opcionais: quando passados, mostram a chamada "Faltam X vendas para a meta"
  // em destaque. faltam já deve vir com piso em 0. semMeta = meta não definida.
  faltam,
  substantivo = 'vendas',
  semMeta = false,
}: {
  titulo: string
  subtitulo?: string
  realizadoLabel: string
  metaLabel: string
  pct: number
  faltam?: number
  substantivo?: string
  semMeta?: boolean
}) {
  const pctClamped = Math.min(Math.max(pct, 0), 100)
  const cor = metaColor(pct)
  const bateu = pct >= 100
  const mostraChamada = faltam !== undefined

  return (
    <div className="card sec-pad">
      <div className="flex items-center justify-between gap-2">
        <div>
          <p className="font-semibold text-white">{titulo}</p>
          {subtitulo && (
            <p className="text-[.72rem] normal-case text-[var(--text-muted)]">{subtitulo}</p>
          )}
        </div>
        <span className={`badge ${cor.badgeClass}`}>{pct.toFixed(0)}%</span>
      </div>

      {mostraChamada && (
        <p className="my-2 normal-case text-white">
          {semMeta ? (
            <span className="text-[var(--text-muted)]">Meta não definida para o mês.</span>
          ) : bateu ? (
            <span className="text-[1.05rem] font-extrabold text-[var(--success)]">
              Meta batida! 🎉
            </span>
          ) : (
            <>
              Faltam{' '}
              <span className="text-[1.4rem] font-extrabold" style={{ color: cor.fillColor }}>
                {faltam}
              </span>{' '}
              {substantivo} para a meta
            </>
          )}
        </p>
      )}

      <div className="meta-track">
        <div className="meta-fill" style={{ width: `${pctClamped}%`, background: cor.fillColor }} />
        <span className="meta-runner" style={{ left: `${pctClamped}%` }}>
          🚗
        </span>
      </div>

      <div className="flex items-center justify-between text-[.72rem] normal-case text-[var(--text-muted)]">
        <span>Realizado: {realizadoLabel}</span>
        <span>Meta: {metaLabel}</span>
      </div>

      {bateu && (
        <div className="meta-confetti">
          {Array.from({ length: 8 }).map((_, i) => (
            <span
              key={i}
              style={{ left: `${(i + 0.5) * (100 / 8)}%`, animationDelay: `${i * 0.15}s` }}
            >
              {['🎉', '✨', '🎊'][i % 3]}
            </span>
          ))}
        </div>
      )}
    </div>
  )
}

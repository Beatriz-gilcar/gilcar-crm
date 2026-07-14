import { metaColor } from '@/lib/metas'

export function MetaWidget({
  titulo,
  subtitulo,
  realizadoLabel,
  metaLabel,
  pct,
}: {
  titulo: string
  subtitulo?: string
  realizadoLabel: string
  metaLabel: string
  pct: number
}) {
  const pctClamped = Math.min(Math.max(pct, 0), 100)
  const cor = metaColor(pct)
  const bateu = pct >= 100

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

      <div className="meta-track">
        <div className="meta-fill" style={{ width: `${pctClamped}%`, background: cor.fillColor }} />
        <span className="meta-runner" style={{ left: `${pctClamped}%` }}>
          🏃
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

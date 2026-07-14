import { login } from './actions'

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>
}) {
  const { error } = await searchParams

  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-6 px-4">
      <div className="flex flex-col items-center gap-2">
        <svg width="230" height="56" viewBox="0 0 250 62" xmlns="http://www.w3.org/2000/svg">
          <rect x="4" y="3" width="46" height="10" fill="#fff" />
          <rect x="4" y="3" width="10" height="56" fill="#fff" />
          <rect x="0" y="28" width="62" height="9" fill="#cc0000" />
          <rect x="44" y="37" width="10" height="19" fill="#fff" />
          <rect x="4" y="47" width="50" height="12" fill="#fff" />
          <text
            x="70"
            y="52"
            fontFamily="Arial Black,Arial,sans-serif"
            fontWeight={900}
            fontSize={46}
            fill="#fff"
          >
            ILCAR
          </text>
        </svg>
        <div className="text-[.75rem] font-semibold tracking-[4px] text-[var(--red)]">
          VEÍCULOS — RJ
        </div>
        <div className="my-1 h-[3px] w-[60px] bg-[var(--red)]" />
      </div>

      <form action={login} className="flex w-full max-w-xs flex-col gap-4">
        {error && (
          <p className="rounded-md bg-[#1a0808] px-3 py-2 text-center text-[.78rem] normal-case text-[var(--red)]">
            {error}
          </p>
        )}

        <div className="form-group">
          <label>E-mail</label>
          <input name="email" type="email" required autoComplete="email" />
        </div>

        <div className="form-group">
          <label>Senha</label>
          <input name="password" type="password" required autoComplete="current-password" />
        </div>

        <button type="submit" className="btn btn-red">
          Entrar
        </button>
      </form>
    </div>
  )
}

import { login } from './actions'

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>
}) {
  const { error } = await searchParams

  return (
    <div className="flex flex-1 items-center justify-center bg-zinc-50 px-4 dark:bg-black">
      <form
        action={login}
        className="flex w-full max-w-sm flex-col gap-4 rounded-xl border border-black/10 bg-white p-8 dark:border-white/10 dark:bg-zinc-950"
      >
        <h1 className="text-xl font-semibold text-black dark:text-zinc-50">
          Gilcar CRM
        </h1>

        {error && (
          <p className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-600 dark:bg-red-950 dark:text-red-400">
            {error}
          </p>
        )}

        <label className="flex flex-col gap-1 text-sm text-zinc-700 dark:text-zinc-300">
          E-mail
          <input
            name="email"
            type="email"
            required
            autoComplete="email"
            className="rounded-md border border-black/10 bg-transparent px-3 py-2 text-black dark:border-white/20 dark:text-zinc-50"
          />
        </label>

        <label className="flex flex-col gap-1 text-sm text-zinc-700 dark:text-zinc-300">
          Senha
          <input
            name="password"
            type="password"
            required
            autoComplete="current-password"
            className="rounded-md border border-black/10 bg-transparent px-3 py-2 text-black dark:border-white/20 dark:text-zinc-50"
          />
        </label>

        <button
          type="submit"
          className="mt-2 rounded-full bg-foreground px-5 py-2 font-medium text-background hover:bg-[#383838] dark:hover:bg-[#ccc]"
        >
          Entrar
        </button>
      </form>
    </div>
  )
}

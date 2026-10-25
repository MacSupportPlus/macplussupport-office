import Link from "next/link";
import { redirect } from "next/navigation";
import { requireUser } from "@/lib/session";

// Signed-in, per-user page: render on each request rather than prerendering a shell.
export const instant = false;

export default async function Home({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  if (await requireUser()) redirect("/dashboard");
  const { error } = await searchParams;

  return (
    <main className="mx-auto flex min-h-screen max-w-2xl flex-col justify-center gap-8 px-6 py-16">
      <div className="space-y-3">
        <p className="text-sm font-medium uppercase tracking-wide text-zinc-500">MacPlusSupport Office · demo</p>
        <h1 className="text-4xl font-semibold tracking-tight">Invoices and bookings for small businesses</h1>
        <p className="text-lg text-zinc-600 dark:text-zinc-400">
          Sign in with any Microsoft account (work, school, or personal outlook.com). You get your own sandbox business
          with fictional clients. Nothing you create is visible to anyone else.
        </p>
      </div>

      {error && (
        <p role="alert" className="rounded-lg border border-red-300 bg-red-50 p-4 text-sm text-red-800">
          {error}
        </p>
      )}

      <div>
        <Link
          href="/api/auth/login"
          prefetch={false}
          className="inline-flex items-center gap-3 rounded-lg bg-zinc-900 px-5 py-3 font-medium text-white hover:bg-zinc-700 dark:bg-white dark:text-zinc-900"
        >
          <svg aria-hidden width="18" height="18" viewBox="0 0 21 21">
            <rect x="1" y="1" width="9" height="9" fill="#f25022" />
            <rect x="11" y="1" width="9" height="9" fill="#7fba00" />
            <rect x="1" y="11" width="9" height="9" fill="#00a4ef" />
            <rect x="11" y="11" width="9" height="9" fill="#ffb900" />
          </svg>
          Sign in with Microsoft
        </Link>
        <p className="mt-3 text-sm text-zinc-500">
          The app asks only to read your basic profile. It never sees your password.
        </p>
      </div>
    </main>
  );
}

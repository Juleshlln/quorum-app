import Link from 'next/link';

export default function NotFound() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-zinc-950 text-white p-6">
      <div className="max-w-md w-full rounded-2xl border border-white/10 bg-zinc-900/40 p-6">
        <h1 className="text-xl font-semibold">Page introuvable</h1>
        <p className="mt-2 text-sm text-zinc-400">
          La page demandée n’existe pas ou a été déplacée.
        </p>
        <div className="mt-4">
          <Link
            href="/"
            className="inline-flex px-4 py-2 rounded-xl bg-white text-black text-sm font-medium"
          >
            Retour à l’accueil
          </Link>
        </div>
      </div>
    </div>
  );
}

import Link from 'next/link';
import { ThemeToggle } from '@/components/theme/theme-toggle';

export default function NotFound() {
  return (
    <div className="min-h-screen flex items-center justify-center p-6 relative overflow-hidden">
      <div className="fixed right-5 top-5 z-20">
        <ThemeToggle />
      </div>
      <div className="max-w-md w-full quorum-panel-strong p-6">
        <h1 className="text-xl font-semibold quorum-text-primary">Page introuvable</h1>
        <p className="mt-2 text-sm quorum-text-muted">
          La page demandée n’existe pas ou a été déplacée.
        </p>
        <div className="mt-4">
          <Link
            href="/"
            className="quorum-btn-primary"
          >
            Retour à l’accueil
          </Link>
        </div>
      </div>
    </div>
  );
}

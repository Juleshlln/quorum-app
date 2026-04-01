'use client';

import Link from 'next/link';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { QuorumLogo } from '@/components/logo';
import { ThemeToggle } from '@/components/theme/theme-toggle';
import { Mail, Lock, ArrowRight, Loader2 } from 'lucide-react';

export default function LoginPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const router = useRouter();
  const supabase = createClient();

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    const { error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (error) {
      setError('Email ou mot de passe incorrect');
      setLoading(false);
    } else {
      router.push('/dashboard');
      router.refresh();
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center px-4 relative overflow-hidden">
      {/* Background gradients */}
      <div className="absolute inset-0 pointer-events-none">
        <div
          className="absolute top-[-30%] left-[-10%] h-[600px] w-[600px] rounded-full blur-[150px]"
          style={{ background: 'var(--quorum-orb-top)' }}
        />
        <div
          className="absolute bottom-[-20%] right-[-10%] h-[500px] w-[500px] rounded-full blur-[130px]"
          style={{ background: 'var(--quorum-orb-bottom)' }}
        />
        <div
          className="absolute left-1/2 top-[50%] h-[300px] w-[300px] -translate-x-1/2 -translate-y-1/2 rounded-full blur-[100px]"
          style={{ background: 'var(--quorum-body-glow-b)' }}
        />
      </div>

      <div className="fixed right-5 top-5 z-20">
        <ThemeToggle />
      </div>

      <div className="w-full max-w-md relative">
        {/* Logo */}
        <div className="text-center mb-8">
          <Link href="/" className="inline-flex items-center gap-3">
            <QuorumLogo adaptive className="h-12 w-[192px]" priority />
          </Link>
          <h1 className="mt-6 text-3xl font-semibold quorum-text-primary">
            Bon retour
          </h1>
          <p className="mt-2 quorum-text-muted">
            Connectez-vous à votre compte
          </p>
        </div>

        {/* Form Card */}
        <div className="quorum-panel-strong p-8">
          <form onSubmit={handleLogin} className="space-y-5">
            {error && (
              <div className="rounded-2xl border border-red-500/20 bg-red-500/10 px-4 py-3 text-sm text-red-100">
                {error}
              </div>
            )}

            <div className="space-y-2">
              <label className="quorum-label">Email</label>
              <div className="relative">
                <Mail className="quorum-input-icon absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5" />
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="vous@exemple.com"
                  className="quorum-input-with-icon py-3.5"
                  required
                />
              </div>
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <label className="quorum-label mb-0">Mot de passe</label>
                <Link
                  href="/forgot-password"
                  className="text-sm quorum-text-muted transition-colors hover:quorum-text-primary"
                >
                  Oublié ?
                </Link>
              </div>
              <div className="relative">
                <Lock className="quorum-input-icon absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5" />
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  className="quorum-input-with-icon py-3.5"
                  required
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="quorum-btn-primary w-full py-3.5"
            >
              {loading ? (
                <Loader2 className="w-5 h-5 animate-spin" />
              ) : (
                <>
                  Se connecter
                  <ArrowRight className="w-5 h-5" />
                </>
              )}
            </button>
          </form>

          <div className="mt-6 pt-6 border-t quorum-border-default">
            <p className="text-center text-sm quorum-text-muted">
              Pas encore de compte ?{' '}
              <Link href="/signup" className="font-medium quorum-text-primary transition-opacity hover:opacity-70">
                Créer un compte
              </Link>
            </p>
          </div>
        </div>

        {/* Footer */}
        <p className="mt-8 text-center text-xs quorum-text-subtle">
          En vous connectant, vous acceptez nos{' '}
          <Link href="/terms" className="quorum-text-muted transition-colors hover:quorum-text-primary">CGU</Link>
          {' '}et notre{' '}
          <Link href="/privacy" className="quorum-text-muted transition-colors hover:quorum-text-primary">Politique de confidentialité</Link>
        </p>
      </div>
    </div>
  );
}

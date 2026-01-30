'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Eye, EyeOff, Loader2, CheckCircle, Check } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';

export default function SignupPage() {
  const router = useRouter();

  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  // Password validation
  const passwordChecks = {
    length: password.length >= 8,
    hasNumber: /\d/.test(password),
    hasLetter: /[a-zA-Z]/.test(password),
  };
  const isPasswordValid = Object.values(passwordChecks).every(Boolean);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!isPasswordValid) {
      setError('Le mot de passe ne respecte pas les critères requis');
      return;
    }

    if (password !== confirmPassword) {
      setError('Les mots de passe ne correspondent pas');
      return;
    }

    setIsLoading(true);

    try {
      const supabase = createClient();

      const { error: signUpError } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: {
            full_name: fullName,
          },
          emailRedirectTo: `${window.location.origin}/auth/callback`,
        },
      });

      if (signUpError) {
        if (signUpError.message.includes('already registered')) {
          setError('Cet email est déjà utilisé. Essayez de vous connecter.');
        } else {
          setError(signUpError.message);
        }
        return;
      }

      setSuccess(true);
    } catch (err) {
      setError('Une erreur est survenue. Veuillez réessayer.');
    } finally {
      setIsLoading(false);
    }
  };

  // Success screen
  if (success) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background px-4">
        <div className="absolute inset-0 bg-grid opacity-30" />
        
        <div className="w-full max-w-md relative text-center">
          <div className="card p-8">
            <div className="w-16 h-16 bg-green-500/10 border border-green-500/20 rounded-full flex items-center justify-center mx-auto mb-6">
              <CheckCircle className="w-8 h-8 text-green-400" />
            </div>
            <h1 className="text-2xl font-semibold text-text-primary mb-2">
              Vérifiez votre email
            </h1>
            <p className="text-text-secondary mb-8">
              Nous avons envoyé un lien de confirmation à{' '}
              <span className="text-text-primary font-medium">{email}</span>
            </p>
            <div className="space-y-3">
              <Link href="/login" className="btn-primary w-full py-3 block">
                Aller à la connexion
              </Link>
              <button
                onClick={() => setSuccess(false)}
                className="btn-ghost w-full py-3"
              >
                Utiliser un autre email
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-background px-4 py-12">
      {/* Background effects */}
      <div className="absolute inset-0 bg-grid opacity-30" />
      <div className="absolute top-1/3 left-1/2 -translate-x-1/2 w-[500px] h-[500px] bg-white/5 rounded-full blur-3xl" />
      
      <div className="w-full max-w-md relative">
        {/* Logo */}
        <div className="text-center mb-10">
          <Link href="/" className="logo text-2xl inline-block mb-2">
            QUORUM
          </Link>
          <h1 className="text-2xl font-semibold text-text-primary mt-6">
            Créer un compte
          </h1>
          <p className="text-text-secondary mt-2">
            Commencez à analyser votre visibilité IA
          </p>
        </div>

        {/* Form */}
        <div className="card p-8">
          <form onSubmit={handleSubmit} className="space-y-5">
            {/* Error message */}
            {error && (
              <div className="bg-red-500/10 border border-red-500/20 text-red-400 px-4 py-3 rounded-lg text-sm">
                {error}
              </div>
            )}

            {/* Full name */}
            <div>
              <label htmlFor="fullName" className="label">
                Nom complet
              </label>
              <input
                id="fullName"
                type="text"
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                className="input"
                placeholder="Jean Dupont"
                required
                autoComplete="name"
                disabled={isLoading}
              />
            </div>

            {/* Email */}
            <div>
              <label htmlFor="email" className="label">
                Email
              </label>
              <input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="input"
                placeholder="vous@exemple.com"
                required
                autoComplete="email"
                disabled={isLoading}
              />
            </div>

            {/* Password */}
            <div>
              <label htmlFor="password" className="label">
                Mot de passe
              </label>
              <div className="relative">
                <input
                  id="password"
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="input pr-10"
                  placeholder="••••••••"
                  required
                  autoComplete="new-password"
                  disabled={isLoading}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-text-tertiary hover:text-text-secondary transition-colors"
                  tabIndex={-1}
                >
                  {showPassword ? (
                    <EyeOff className="w-5 h-5" />
                  ) : (
                    <Eye className="w-5 h-5" />
                  )}
                </button>
              </div>
              
              {/* Password strength indicators */}
              {password && (
                <div className="mt-3 space-y-1.5">
                  <PasswordCheck checked={passwordChecks.length} text="Au moins 8 caractères" />
                  <PasswordCheck checked={passwordChecks.hasLetter} text="Au moins une lettre" />
                  <PasswordCheck checked={passwordChecks.hasNumber} text="Au moins un chiffre" />
                </div>
              )}
            </div>

            {/* Confirm password */}
            <div>
              <label htmlFor="confirmPassword" className="label">
                Confirmer le mot de passe
              </label>
              <input
                id="confirmPassword"
                type={showPassword ? 'text' : 'password'}
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                className={`input ${
                  confirmPassword && confirmPassword !== password
                    ? 'border-red-500/50 focus:border-red-500'
                    : ''
                }`}
                placeholder="••••••••"
                required
                autoComplete="new-password"
                disabled={isLoading}
              />
              {confirmPassword && confirmPassword !== password && (
                <p className="mt-2 text-sm text-red-400">
                  Les mots de passe ne correspondent pas
                </p>
              )}
            </div>

            {/* Submit button */}
            <button
              type="submit"
              disabled={isLoading || !isPasswordValid || password !== confirmPassword}
              className="btn-primary w-full py-3"
            >
              {isLoading ? (
                <>
                  <Loader2 className="w-5 h-5 animate-spin" />
                  Création du compte...
                </>
              ) : (
                'Créer mon compte'
              )}
            </button>
          </form>

          {/* Login link */}
          <div className="mt-6 text-center text-sm">
            <span className="text-text-secondary">Déjà un compte ?</span>{' '}
            <Link href="/login" className="text-white hover:text-neutral-300 font-medium transition-colors">
              Se connecter
            </Link>
          </div>
        </div>

        {/* Legal */}
        <p className="mt-6 text-center text-xs text-text-tertiary">
          En créant un compte, vous acceptez nos{' '}
          <Link href="/terms" className="text-text-secondary hover:text-text-primary transition-colors">
            Conditions
          </Link>{' '}
          et notre{' '}
          <Link href="/privacy" className="text-text-secondary hover:text-text-primary transition-colors">
            Politique de confidentialité
          </Link>
        </p>
      </div>
    </div>
  );
}

function PasswordCheck({ checked, text }: { checked: boolean; text: string }) {
  return (
    <div className={`flex items-center gap-2 text-sm transition-colors ${
      checked ? 'text-green-400' : 'text-text-tertiary'
    }`}>
      <div className={`w-4 h-4 rounded-full border flex items-center justify-center transition-colors ${
        checked 
          ? 'bg-green-500/20 border-green-500/50' 
          : 'border-border'
      }`}>
        {checked && <Check className="w-2.5 h-2.5" />}
      </div>
      {text}
    </div>
  );
}

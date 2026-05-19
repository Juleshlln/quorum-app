import { createClient } from '@/lib/supabase/server';
import { User, Mail, Key, CreditCard, Bell, Shield, Sparkles, Check, ArrowRight } from 'lucide-react';
import Link from 'next/link';

export const metadata = {
  title: 'Paramètres | Quorum',
};

export default async function SettingsPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  const displayName = user?.user_metadata?.full_name || user?.email?.split('@')[0] || 'Utilisateur';

  return (
    <div className="space-y-8 max-w-4xl">
      <div className="quorum-panel-strong p-6">
        <p className="quorum-kicker">Paramètres</p>
        <h1 className="mt-2 text-4xl font-bold tracking-[-0.05em] quorum-text-primary">Gérez votre compte</h1>
        <p className="mt-2 text-sm quorum-text-muted">Gérez votre compte et vos préférences</p>
      </div>

      {/* Profile Section */}
      <section className="quorum-panel overflow-hidden">
        <div className="px-6 py-4 border-b quorum-border-default">
          <h2 className="font-semibold quorum-text-primary flex items-center gap-2">
            <User className="w-5 h-5 quorum-text-muted" />
            Profil
          </h2>
        </div>
        <div className="p-6 space-y-6">
          <div className="flex items-center gap-5">
            <div className="flex h-20 w-20 items-center justify-center rounded-3xl border quorum-border-default quorum-surface-strong">
              <span className="text-3xl font-bold quorum-text-primary">
                {displayName.charAt(0).toUpperCase()}
              </span>
            </div>
            <div>
              <h3 className="text-xl font-semibold quorum-text-primary">{displayName}</h3>
              <p className="quorum-text-muted">{user?.email}</p>
              <p className="mt-1 text-xs quorum-text-subtle">Membre depuis janvier 2026</p>
            </div>
          </div>

          <div className="grid md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <label className="quorum-label mb-0">Nom complet</label>
              <input 
                type="text" 
                defaultValue={displayName}
                className="quorum-input"
              />
            </div>
            <div className="space-y-2">
              <label className="quorum-label mb-0">Email</label>
              <input 
                type="email" 
                defaultValue={user?.email || ''}
                disabled
                className="w-full cursor-not-allowed rounded-xl border quorum-border-default quorum-surface px-4 py-3 quorum-text-subtle"
              />
            </div>
          </div>

          <button className="quorum-btn-primary">
            Sauvegarder
          </button>
        </div>
      </section>

      {/* Subscription Section */}
      <section className="quorum-panel overflow-hidden">
        <div className="px-6 py-4 border-b quorum-border-default">
          <h2 className="font-semibold quorum-text-primary flex items-center gap-2">
            <CreditCard className="w-5 h-5 quorum-text-muted" />
            Abonnement
          </h2>
        </div>
        <div className="p-6">
          <div className="flex items-start justify-between mb-6">
            <div>
              <div className="flex items-center gap-3 mb-2">
                <span className="text-xl font-semibold quorum-text-primary">Plan Starter</span>
                <span className="rounded-full border quorum-border-default quorum-surface px-2 py-0.5 text-xs quorum-text-muted">Gratuit</span>
              </div>
              <p className="text-sm quorum-text-muted">1 projet • 5 analyses/mois • 1 modèle IA</p>
            </div>
          </div>

          {/* Upgrade Card */}
          <div className="rounded-3xl border quorum-border-default quorum-surface p-5">
            <div className="flex items-center gap-2 mb-3">
              <Sparkles className="w-5 h-5 quorum-text-primary" />
              <span className="font-semibold quorum-text-primary">Passez à Pro</span>
            </div>
            <p className="mb-4 text-sm quorum-text-muted">
              Débloquez les analyses illimitées, tous les modèles IA et les fonctionnalités avancées.
            </p>
            <ul className="space-y-2 mb-5">
              <li className="flex items-center gap-2 text-sm quorum-text-primary">
                <Check className="w-4 h-4 quorum-text-primary" />
                Projets illimités
              </li>
              <li className="flex items-center gap-2 text-sm quorum-text-primary">
                <Check className="w-4 h-4 quorum-text-primary" />
                Analyses illimitées
              </li>
              <li className="flex items-center gap-2 text-sm quorum-text-primary">
                <Check className="w-4 h-4 quorum-text-primary" />
                ChatGPT, Claude, Gemini, Perplexity
              </li>
              <li className="flex items-center gap-2 text-sm quorum-text-primary">
                <Check className="w-4 h-4 quorum-text-primary" />
                Export PDF/CSV
              </li>
            </ul>
            <button className="quorum-btn-primary w-full justify-center">
              Passer à Pro — 29€/mois
              <ArrowRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      </section>

      {/* API Keys Section */}
      <section className="quorum-panel overflow-hidden">
        <div className="px-6 py-4 border-b quorum-border-default">
          <h2 className="font-semibold quorum-text-primary flex items-center gap-2">
            <Key className="w-5 h-5 quorum-text-muted" />
            Clés API
          </h2>
        </div>
        <div className="p-6 space-y-4">
          <p className="text-sm quorum-text-muted">
            Configurez vos propres clés API pour utiliser vos crédits personnels.
          </p>
          
          <div className="space-y-2">
            <label className="quorum-label mb-0">OpenAI API Key</label>
            <input 
              type="password" 
              placeholder="sk-..."
              className="quorum-input"
            />
            <p className="text-xs quorum-text-subtle">Utilisée pour les analyses ChatGPT</p>
          </div>

          <button className="quorum-btn-secondary">
            Sauvegarder les clés
          </button>
        </div>
      </section>

      {/* Notifications Section */}
      <section className="quorum-panel overflow-hidden">
        <div className="px-6 py-4 border-b quorum-border-default">
          <h2 className="font-semibold quorum-text-primary flex items-center gap-2">
            <Bell className="w-5 h-5 quorum-text-muted" />
            Notifications
          </h2>
        </div>
        <div className="p-6 space-y-4">
          <NotificationToggle 
            label="Analyses terminées" 
            description="Recevoir un email quand une analyse est terminée"
            defaultChecked={true}
          />
          <NotificationToggle 
            label="Rapports hebdomadaires" 
            description="Recevoir un résumé de vos scores chaque semaine"
            defaultChecked={false}
          />
          <NotificationToggle 
            label="Alertes de baisse" 
            description="Être notifié si votre score baisse significativement"
            defaultChecked={true}
          />
        </div>
      </section>

      {/* Security Section */}
      <section className="quorum-panel overflow-hidden">
        <div className="px-6 py-4 border-b quorum-border-default">
          <h2 className="font-semibold quorum-text-primary flex items-center gap-2">
            <Shield className="w-5 h-5 quorum-text-muted" />
            Sécurité
          </h2>
        </div>
        <div className="p-6 space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="font-medium quorum-text-primary">Changer le mot de passe</p>
              <p className="text-sm quorum-text-muted">Dernière modification il y a 30 jours</p>
            </div>
            <button className="quorum-btn-secondary">
              Modifier
            </button>
          </div>
          <div className="flex items-center justify-between pt-4 border-t quorum-border-default">
            <div>
              <p className="font-medium text-red-400">Supprimer le compte</p>
              <p className="text-sm quorum-text-muted">Cette action est irréversible</p>
            </div>
            <button className="px-4 py-2 text-sm font-medium text-red-400 hover:text-red-300 border border-red-500/20 rounded-xl hover:border-red-500/40 transition-all">
              Supprimer
            </button>
          </div>
        </div>
      </section>
    </div>
  );
}

function NotificationToggle({ 
  label, 
  description, 
  defaultChecked 
}: { 
  label: string; 
  description: string; 
  defaultChecked: boolean;
}) {
  return (
    <div className="flex items-center justify-between">
      <div>
        <p className="font-medium quorum-text-primary">{label}</p>
        <p className="text-sm quorum-text-muted">{description}</p>
      </div>
      <label className="relative inline-flex items-center cursor-pointer">
        <input type="checkbox" defaultChecked={defaultChecked} className="sr-only peer" />
        <div className="quorum-switch"></div>
      </label>
    </div>
  );
}

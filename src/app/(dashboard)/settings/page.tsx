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
      <div>
        <h1 className="text-3xl font-semibold text-white">Paramètres</h1>
        <p className="text-zinc-400 mt-1">Gérez votre compte et vos préférences</p>
      </div>

      {/* Profile Section */}
      <section className="rounded-2xl border border-white/[0.08] bg-zinc-900/30 overflow-hidden">
        <div className="px-6 py-4 border-b border-white/[0.06]">
          <h2 className="font-semibold text-white flex items-center gap-2">
            <User className="w-5 h-5 text-cyan-400" />
            Profil
          </h2>
        </div>
        <div className="p-6 space-y-6">
          <div className="flex items-center gap-5">
            <div className="w-20 h-20 bg-gradient-to-br from-blue-500/20 via-cyan-500/20 to-violet-500/20 border border-white/[0.1] rounded-2xl flex items-center justify-center">
              <span className="text-3xl font-bold bg-gradient-to-r from-cyan-400 to-blue-400 bg-clip-text text-transparent">
                {displayName.charAt(0).toUpperCase()}
              </span>
            </div>
            <div>
              <h3 className="text-xl font-semibold text-white">{displayName}</h3>
              <p className="text-zinc-400">{user?.email}</p>
              <p className="text-xs text-zinc-500 mt-1">Membre depuis janvier 2026</p>
            </div>
          </div>

          <div className="grid md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <label className="text-sm text-zinc-400">Nom complet</label>
              <input 
                type="text" 
                defaultValue={displayName}
                className="w-full bg-white/[0.05] border border-white/[0.08] rounded-xl px-4 py-3 text-white placeholder:text-zinc-600 focus:outline-none focus:border-cyan-500/50 transition-colors"
              />
            </div>
            <div className="space-y-2">
              <label className="text-sm text-zinc-400">Email</label>
              <input 
                type="email" 
                defaultValue={user?.email || ''}
                disabled
                className="w-full bg-white/[0.03] border border-white/[0.05] rounded-xl px-4 py-3 text-zinc-500 cursor-not-allowed"
              />
            </div>
          </div>

          <button className="px-5 py-2.5 bg-gradient-to-r from-blue-500 via-cyan-500 to-violet-500 text-white text-sm font-medium rounded-xl hover:opacity-90 transition-all">
            Sauvegarder
          </button>
        </div>
      </section>

      {/* Subscription Section */}
      <section className="rounded-2xl border border-white/[0.08] bg-zinc-900/30 overflow-hidden">
        <div className="px-6 py-4 border-b border-white/[0.06]">
          <h2 className="font-semibold text-white flex items-center gap-2">
            <CreditCard className="w-5 h-5 text-cyan-400" />
            Abonnement
          </h2>
        </div>
        <div className="p-6">
          <div className="flex items-start justify-between mb-6">
            <div>
              <div className="flex items-center gap-3 mb-2">
                <span className="text-xl font-semibold text-white">Plan Starter</span>
                <span className="px-2 py-0.5 bg-zinc-800 text-zinc-400 text-xs rounded-full">Gratuit</span>
              </div>
              <p className="text-sm text-zinc-400">1 projet • 5 analyses/mois • 1 modèle IA</p>
            </div>
          </div>

          {/* Upgrade Card */}
          <div className="p-5 rounded-2xl bg-gradient-to-br from-blue-500/10 via-cyan-500/10 to-violet-500/10 border border-blue-500/20">
            <div className="flex items-center gap-2 mb-3">
              <Sparkles className="w-5 h-5 text-cyan-400" />
              <span className="font-semibold text-white">Passez à Pro</span>
            </div>
            <p className="text-sm text-zinc-400 mb-4">
              Débloquez les analyses illimitées, tous les modèles IA et les fonctionnalités avancées.
            </p>
            <ul className="space-y-2 mb-5">
              <li className="flex items-center gap-2 text-sm text-zinc-300">
                <Check className="w-4 h-4 text-cyan-400" />
                Projets illimités
              </li>
              <li className="flex items-center gap-2 text-sm text-zinc-300">
                <Check className="w-4 h-4 text-cyan-400" />
                Analyses illimitées
              </li>
              <li className="flex items-center gap-2 text-sm text-zinc-300">
                <Check className="w-4 h-4 text-cyan-400" />
                ChatGPT, Claude, Gemini, Perplexity
              </li>
              <li className="flex items-center gap-2 text-sm text-zinc-300">
                <Check className="w-4 h-4 text-cyan-400" />
                Export PDF/CSV
              </li>
            </ul>
            <button className="flex items-center gap-2 px-5 py-3 bg-gradient-to-r from-blue-500 via-cyan-500 to-violet-500 text-white font-medium rounded-xl hover:opacity-90 transition-all w-full justify-center">
              Passer à Pro — 29€/mois
              <ArrowRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      </section>

      {/* API Keys Section */}
      <section className="rounded-2xl border border-white/[0.08] bg-zinc-900/30 overflow-hidden">
        <div className="px-6 py-4 border-b border-white/[0.06]">
          <h2 className="font-semibold text-white flex items-center gap-2">
            <Key className="w-5 h-5 text-cyan-400" />
            Clés API
          </h2>
        </div>
        <div className="p-6 space-y-4">
          <p className="text-sm text-zinc-400">
            Configurez vos propres clés API pour utiliser vos crédits personnels.
          </p>
          
          <div className="space-y-2">
            <label className="text-sm text-zinc-400">OpenAI API Key</label>
            <input 
              type="password" 
              placeholder="sk-..."
              className="w-full bg-white/[0.05] border border-white/[0.08] rounded-xl px-4 py-3 text-white placeholder:text-zinc-600 focus:outline-none focus:border-cyan-500/50 transition-colors"
            />
            <p className="text-xs text-zinc-500">Utilisée pour les analyses ChatGPT</p>
          </div>

          <button className="px-5 py-2.5 bg-zinc-800 text-white text-sm font-medium rounded-xl hover:bg-zinc-700 transition-colors">
            Sauvegarder les clés
          </button>
        </div>
      </section>

      {/* Notifications Section */}
      <section className="rounded-2xl border border-white/[0.08] bg-zinc-900/30 overflow-hidden">
        <div className="px-6 py-4 border-b border-white/[0.06]">
          <h2 className="font-semibold text-white flex items-center gap-2">
            <Bell className="w-5 h-5 text-cyan-400" />
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
      <section className="rounded-2xl border border-white/[0.08] bg-zinc-900/30 overflow-hidden">
        <div className="px-6 py-4 border-b border-white/[0.06]">
          <h2 className="font-semibold text-white flex items-center gap-2">
            <Shield className="w-5 h-5 text-cyan-400" />
            Sécurité
          </h2>
        </div>
        <div className="p-6 space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="font-medium text-white">Changer le mot de passe</p>
              <p className="text-sm text-zinc-400">Dernière modification il y a 30 jours</p>
            </div>
            <button className="px-4 py-2 text-sm font-medium text-zinc-400 hover:text-white border border-white/[0.08] rounded-xl hover:border-white/[0.15] transition-all">
              Modifier
            </button>
          </div>
          <div className="flex items-center justify-between pt-4 border-t border-white/[0.06]">
            <div>
              <p className="font-medium text-red-400">Supprimer le compte</p>
              <p className="text-sm text-zinc-400">Cette action est irréversible</p>
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
        <p className="font-medium text-white">{label}</p>
        <p className="text-sm text-zinc-400">{description}</p>
      </div>
      <label className="relative inline-flex items-center cursor-pointer">
        <input type="checkbox" defaultChecked={defaultChecked} className="sr-only peer" />
        <div className="w-11 h-6 bg-zinc-700 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-gradient-to-r peer-checked:from-cyan-500 peer-checked:to-blue-500"></div>
      </label>
    </div>
  );
}

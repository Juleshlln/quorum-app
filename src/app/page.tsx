'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import {
  ArrowRight,
  Sparkles,
  Eye,
  Target,
  TrendingUp,
  Zap,
  BarChart3,
  Shield,
  Check,
} from 'lucide-react';

export default function HomePage() {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  return (
    <div className="min-h-screen bg-[#0a0a0a] text-white antialiased overflow-x-hidden">
      {/* Animated Background Gradient (Gemini-style blues) */}
      <div className="fixed inset-0 pointer-events-none">
        <div className="absolute top-0 left-1/4 w-[650px] h-[650px] bg-blue-500/12 rounded-full blur-[130px] animate-pulse" />
        <div className="absolute bottom-0 right-1/4 w-[500px] h-[500px] bg-indigo-500/10 rounded-full blur-[120px]" />
        <div className="absolute top-1/3 right-0 w-[420px] h-[420px] bg-violet-500/8 rounded-full blur-[120px]" />
      </div>

      {/* Navigation */}
      <nav
        className={`fixed top-0 left-0 right-0 z-50 transition-all duration-700 ${
          mounted ? 'translate-y-0 opacity-100' : '-translate-y-4 opacity-0'
        }`}
      >
        <div className="max-w-7xl mx-auto px-6 py-4">
          <div className="flex items-center justify-between bg-white/5 backdrop-blur-xl border border-white/10 rounded-2xl px-6 py-3">
            <Link href="/" className="flex items-center gap-3">
              <div className="w-8 h-8 bg-gradient-to-br from-blue-400 via-indigo-400 to-violet-500 rounded-lg flex items-center justify-center">
                <span className="text-black font-bold text-sm">Q</span>
              </div>
              <span className="font-semibold text-lg tracking-tight">Quorum</span>
            </Link>

            <div className="hidden md:flex items-center gap-8">
              <Link href="#features" className="text-sm text-zinc-400 hover:text-white transition-colors">
                Features
              </Link>
              <Link href="#how-it-works" className="text-sm text-zinc-400 hover:text-white transition-colors">
                How it works
              </Link>
              <Link href="#pricing" className="text-sm text-zinc-400 hover:text-white transition-colors">
                Pricing
              </Link>
            </div>

            <div className="flex items-center gap-3">
              <Link href="/login" className="text-sm text-zinc-400 hover:text-white transition-colors px-4 py-2">
                Login
              </Link>
              <Link
                href="/signup"
                className="bg-white text-black text-sm font-medium px-5 py-2.5 rounded-xl hover:bg-zinc-200 transition-all hover:scale-105"
              >
                Get Started
              </Link>
            </div>
          </div>
        </div>
      </nav>

      {/* Hero Section */}
      <section className="relative min-h-screen flex items-center justify-center pt-32 pb-20 px-6">
        <div className="max-w-5xl mx-auto text-center">
          {/* Badge */}
          <div
            className={`inline-flex items-center gap-2 px-4 py-2 rounded-full bg-blue-400/10 border border-blue-400/20 mb-8 transition-all duration-700 delay-100 ${
              mounted ? 'translate-y-0 opacity-100' : 'translate-y-4 opacity-0'
            }`}
          >
            <Sparkles className="w-4 h-4 text-blue-300" />
            <span className="text-sm text-blue-200 font-medium">GEO is the new SEO</span>
          </div>

          {/* Main Headline */}
          <h1
            className={`text-5xl md:text-7xl lg:text-8xl font-semibold tracking-tight leading-[1.05] mb-8 transition-all duration-700 delay-200 ${
              mounted ? 'translate-y-0 opacity-100' : 'translate-y-8 opacity-0'
            }`}
          >
            Mesurez votre
            <br />
            <span className="bg-gradient-to-r from-blue-400 via-indigo-400 to-violet-400 bg-clip-text text-transparent">
              visibilité IA
            </span>
          </h1>

          {/* Subheadline */}
          <p
            className={`text-xl md:text-2xl text-zinc-400 max-w-2xl mx-auto leading-relaxed mb-12 transition-all duration-700 delay-300 ${
              mounted ? 'translate-y-0 opacity-100' : 'translate-y-8 opacity-0'
            }`}
          >
            Découvrez comment ChatGPT, Claude et Gemini parlent de votre marque. Optimisez votre présence dans les réponses IA.
          </p>

          {/* CTA Buttons */}
          <div
            className={`flex flex-col sm:flex-row items-center justify-center gap-4 mb-16 transition-all duration-700 delay-400 ${
              mounted ? 'translate-y-0 opacity-100' : 'translate-y-8 opacity-0'
            }`}
          >
            <Link
              href="/signup"
              className="group flex items-center gap-2 bg-white text-black px-8 py-4 rounded-2xl text-base font-semibold hover:bg-zinc-100 transition-all hover:scale-105 hover:shadow-[0_0_50px_rgba(59,130,246,0.25)]"
            >
              Commencer gratuitement
              <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
            </Link>
            <Link
              href="#demo"
              className="flex items-center gap-2 px-8 py-4 rounded-2xl text-base font-medium text-zinc-400 hover:text-white border border-zinc-800 hover:border-zinc-700 transition-all"
            >
              Voir la démo
            </Link>
          </div>

          {/* Stats */}
          <div
            className={`grid grid-cols-2 md:grid-cols-4 gap-8 max-w-3xl mx-auto transition-all duration-700 delay-500 ${
              mounted ? 'translate-y-0 opacity-100' : 'translate-y-8 opacity-0'
            }`}
          >
            <Stat value="4+" label="Modèles IA" />
            <Stat value="13" label="Prompts analysés" />
            <Stat value="< 2min" label="Temps d'analyse" />
            <Stat value="100%" label="Actionnable" />
          </div>
        </div>

        {/* Scroll indicator */}
        <div className="absolute bottom-8 left-1/2 -translate-x-1/2 animate-bounce">
          <div className="w-6 h-10 rounded-full border-2 border-zinc-700 flex items-start justify-center pt-2">
            <div className="w-1.5 h-3 bg-zinc-500 rounded-full animate-pulse" />
          </div>
        </div>
      </section>

      {/* Dashboard Preview Section */}
      <section className="relative py-32 px-6">
        <div className="max-w-6xl mx-auto">
          <div
            className={`relative rounded-3xl border border-white/10 bg-gradient-to-b from-zinc-900/50 to-zinc-950 p-2 shadow-2xl shadow-black/50 transition-all duration-1000 ${
              mounted ? 'translate-y-0 opacity-100' : 'translate-y-16 opacity-0'
            }`}
            style={{ transitionDelay: '600ms' }}
          >
            {/* Glow effect */}
            <div className="absolute -inset-1 bg-gradient-to-r from-blue-500/18 via-indigo-500/18 to-violet-500/18 rounded-3xl blur-xl opacity-60" />

            {/* Dashboard mockup */}
            <div className="relative bg-[#0d0d0d] rounded-2xl overflow-hidden">
              {/* Browser bar */}
              <div className="flex items-center gap-2 px-4 py-3 border-b border-white/5">
                <div className="flex gap-1.5">
                  <div className="w-3 h-3 rounded-full bg-red-500/80" />
                  <div className="w-3 h-3 rounded-full bg-yellow-500/80" />
                  <div className="w-3 h-3 rounded-full bg-green-500/80" />
                </div>
                <div className="flex-1 flex justify-center">
                  <div className="bg-zinc-800/50 rounded-lg px-4 py-1.5 text-xs text-zinc-500">
                    app.quorum.ai/dashboard
                  </div>
                </div>
              </div>

              {/* Dashboard content */}
              <div className="p-6 min-h-[500px] grid grid-cols-12 gap-4">
                {/* Sidebar */}
                <div className="col-span-2 space-y-2">
                  <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-blue-400/10 text-blue-300 text-sm">
                    <BarChart3 className="w-4 h-4" />
                    <span className="hidden lg:inline">Dashboard</span>
                  </div>
                  <div className="flex items-center gap-2 px-3 py-2 rounded-lg text-zinc-500 text-sm">
                    <Eye className="w-4 h-4" />
                    <span className="hidden lg:inline">Projets</span>
                  </div>
                  <div className="flex items-center gap-2 px-3 py-2 rounded-lg text-zinc-500 text-sm">
                    <Zap className="w-4 h-4" />
                    <span className="hidden lg:inline">Analyses</span>
                  </div>
                </div>

                {/* Main content */}
                <div className="col-span-10 space-y-4">
                  {/* Score cards */}
                  <div className="grid grid-cols-4 gap-4">
                    <ScoreCard label="Score Global" value="76%" color="blue" />
                    <ScoreCard label="Visibilité" value="77%" color="cyan" />
                    <ScoreCard label="Position" value="100%" color="violet" />
                    <ScoreCard label="Sentiment" value="50%" color="pink" />
                  </div>

                  {/* Chart placeholder */}
                  <div className="bg-zinc-900/50 rounded-xl border border-white/5 p-6">
                    <div className="flex items-center justify-between mb-6">
                      <span className="text-sm font-medium text-white">Évolution du score</span>
                      <span className="text-xs text-zinc-500">30 derniers jours</span>
                    </div>
                    <div className="flex items-end gap-2 h-32">
                      {[40, 55, 45, 60, 52, 68, 72, 65, 78, 76].map((height, i) => (
                        <div
                          key={i}
                          className="flex-1 bg-gradient-to-t from-blue-500/45 via-indigo-500/55 to-violet-400/70 rounded-t transition-all hover:opacity-90"
                          style={{ height: `${height}%` }}
                        />
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section id="features" className="py-32 px-6">
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-20">
            <h2 className="text-4xl md:text-5xl font-semibold tracking-tight mb-6">
              Tout ce dont vous avez besoin
            </h2>
            <p className="text-xl text-zinc-400 max-w-2xl mx-auto">
              Des outils puissants pour comprendre et améliorer votre présence dans les réponses IA
            </p>
          </div>

          <div className="grid md:grid-cols-3 gap-6">
            <FeatureCard
              icon={<Eye className="w-6 h-6" />}
              title="Analyse de visibilité"
              description="Découvrez à quelle fréquence votre marque est mentionnée dans les réponses des IA"
              color="blue"
            />
            <FeatureCard
              icon={<Target className="w-6 h-6" />}
              title="Suivi de position"
              description="Voyez où vous apparaissez dans les listes et recommandations générées par l'IA"
              color="cyan"
            />
            <FeatureCard
              icon={<TrendingUp className="w-6 h-6" />}
              title="Analyse de sentiment"
              description="Comprenez comment l'IA perçoit et présente votre marque aux utilisateurs"
              color="violet"
            />
            <FeatureCard
              icon={<Zap className="w-6 h-6" />}
              title="Prompts personnalisés"
              description="Testez vos propres questions pour voir comment l'IA répond dans votre contexte"
              color="pink"
            />
            <FeatureCard
              icon={<BarChart3 className="w-6 h-6" />}
              title="Rapports détaillés"
              description="Obtenez des insights complets avec des graphiques d'évolution et comparatifs"
              color="indigo"
            />
            <FeatureCard
              icon={<Shield className="w-6 h-6" />}
              title="Multi-modèles"
              description="Analysez votre présence sur ChatGPT, Claude, Gemini et Perplexity"
              color="slate"
            />
          </div>
        </div>
      </section>

      {/* How it works */}
      <section id="how-it-works" className="py-32 px-6 bg-gradient-to-b from-transparent via-zinc-900/30 to-transparent">
        <div className="max-w-5xl mx-auto">
          <div className="text-center mb-20">
            <h2 className="text-4xl md:text-5xl font-semibold tracking-tight mb-6">
              Comment ça marche
            </h2>
            <p className="text-xl text-zinc-400">Trois étapes simples pour optimiser votre visibilité IA</p>
          </div>

          <div className="grid md:grid-cols-3 gap-12">
            <Step
              number="01"
              title="Créez votre projet"
              description="Ajoutez votre marque, vos concurrents et vos mots-clés pour personnaliser l'analyse"
            />
            <Step
              number="02"
              title="Lancez l'analyse"
              description="Notre moteur interroge les IA avec des prompts pertinents pour votre secteur"
            />
            <Step
              number="03"
              title="Optimisez"
              description="Suivez l'évolution de vos scores et appliquez les recommandations"
            />
          </div>
        </div>
      </section>

      {/* Pricing Section */}
      <section id="pricing" className="py-32 px-6">
        <div className="max-w-5xl mx-auto">
          <div className="text-center mb-20">
            <h2 className="text-4xl md:text-5xl font-semibold tracking-tight mb-6">Tarifs simples</h2>
            <p className="text-xl text-zinc-400">Commencez gratuitement, évoluez selon vos besoins</p>
          </div>

          <div className="grid md:grid-cols-2 gap-6 max-w-3xl mx-auto">
            <PricingCard
              name="Starter"
              price="Gratuit"
              description="Pour découvrir Quorum"
              features={['1 projet', '5 analyses par mois', '1 modèle IA (ChatGPT)', 'Historique 7 jours']}
            />
            <PricingCard
              name="Pro"
              price="29€"
              period="/mois"
              description="Pour les équipes marketing"
              features={[
                'Projets illimités',
                'Analyses illimitées',
                '4 modèles IA',
                'Historique illimité',
                'Prompts personnalisés',
                'Export PDF/CSV',
              ]}
              highlighted
            />
          </div>
        </div>
      </section>

      {/* Final CTA */}
      <section className="py-32 px-6">
        <div className="max-w-4xl mx-auto text-center">
          <h2 className="text-4xl md:text-6xl font-semibold tracking-tight mb-6">
            Prêt à dominer
            <br />
            <span className="bg-gradient-to-r from-blue-400 via-indigo-400 to-violet-400 bg-clip-text text-transparent">
              les réponses IA ?
            </span>
          </h2>
          <p className="text-xl text-zinc-400 mb-10 max-w-xl mx-auto">
            Rejoignez les entreprises qui optimisent déjà leur visibilité dans les réponses générées par l&apos;IA.
          </p>
          <Link
            href="/signup"
            className="group inline-flex items-center gap-2 bg-white text-black px-10 py-5 rounded-2xl text-lg font-semibold hover:bg-zinc-100 transition-all hover:scale-105 hover:shadow-[0_0_70px_rgba(59,130,246,0.25)]"
          >
            Commencer maintenant
            <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
          </Link>
          <p className="mt-6 text-sm text-zinc-500">Gratuit • Aucune carte requise • Configuration en 2 minutes</p>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-white/5 py-12 px-6">
        <div className="max-w-6xl mx-auto flex flex-col md:flex-row items-center justify-between gap-6">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 bg-gradient-to-br from-blue-400 via-indigo-400 to-violet-500 rounded-lg flex items-center justify-center">
              <span className="text-black font-bold text-sm">Q</span>
            </div>
            <span className="text-zinc-500 text-sm">© 2026 Quorum. Tous droits réservés.</span>
          </div>
          <div className="flex gap-8 text-sm text-zinc-500">
            <Link href="/privacy" className="hover:text-white transition-colors">
              Confidentialité
            </Link>
            <Link href="/terms" className="hover:text-white transition-colors">
              CGU
            </Link>
            <Link href="/contact" className="hover:text-white transition-colors">
              Contact
            </Link>
          </div>
        </div>
      </footer>
    </div>
  );
}

// Components
function Stat({ value, label }: { value: string; label: string }) {
  return (
    <div className="text-center">
      <div className="text-3xl md:text-4xl font-semibold text-white mb-1">{value}</div>
      <div className="text-sm text-zinc-500">{label}</div>
    </div>
  );
}

function ScoreCard({ label, value, color }: { label: string; value: string; color: string }) {
  const colors: Record<string, string> = {
    blue: 'text-blue-400',
    cyan: 'text-cyan-400',
    violet: 'text-violet-400',
    pink: 'text-pink-400',
  };

  return (
    <div className="bg-zinc-900/50 rounded-xl border border-white/5 p-4">
      <div className="text-xs text-zinc-500 mb-2">{label}</div>
      <div className={`text-2xl font-semibold ${colors[color] ?? 'text-white'}`}>{value}</div>
    </div>
  );
}

function FeatureCard({
  icon,
  title,
  description,
  color,
}: {
  icon: React.ReactNode;
  title: string;
  description: string;
  color: string;
}) {
  const styles: Record<
    string,
    { shell: string; icon: string }
  > = {
    blue: {
      shell: 'from-blue-500/18 to-blue-500/0 border-blue-500/18 group-hover:border-blue-500/35',
      icon: 'text-blue-300',
    },
    cyan: {
      shell: 'from-cyan-500/16 to-cyan-500/0 border-cyan-500/18 group-hover:border-cyan-500/35',
      icon: 'text-cyan-300',
    },
    violet: {
      shell: 'from-violet-500/16 to-violet-500/0 border-violet-500/18 group-hover:border-violet-500/35',
      icon: 'text-violet-300',
    },
    pink: {
      shell: 'from-pink-500/14 to-pink-500/0 border-pink-500/18 group-hover:border-pink-500/35',
      icon: 'text-pink-300',
    },
    indigo: {
      shell: 'from-indigo-500/16 to-indigo-500/0 border-indigo-500/18 group-hover:border-indigo-500/35',
      icon: 'text-indigo-300',
    },
    slate: {
      shell: 'from-slate-500/12 to-slate-500/0 border-white/10 group-hover:border-white/20',
      icon: 'text-zinc-200',
    },
  };

  const s = styles[color] ?? styles.blue;

  return (
    <div
      className={`group relative p-6 rounded-2xl border bg-gradient-to-b transition-all duration-300 hover:scale-[1.02] ${s.shell}`}
    >
      <div
        className={`w-12 h-12 rounded-xl bg-zinc-900 border border-white/10 flex items-center justify-center mb-4 ${s.icon}`}
      >
        {icon}
      </div>
      <h3 className="text-lg font-semibold text-white mb-2">{title}</h3>
      <p className="text-zinc-400 text-sm leading-relaxed">{description}</p>
    </div>
  );
}

function Step({ number, title, description }: { number: string; title: string; description: string }) {
  return (
    <div className="text-center">
      <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-gradient-to-br from-blue-400/16 via-indigo-400/14 to-violet-400/16 border border-blue-400/20 mb-6">
        <span className="text-2xl font-bold bg-gradient-to-r from-blue-300 via-indigo-300 to-violet-300 bg-clip-text text-transparent">
          {number}
        </span>
      </div>
      <h3 className="text-xl font-semibold text-white mb-3">{title}</h3>
      <p className="text-zinc-400 leading-relaxed">{description}</p>
    </div>
  );
}

function PricingCard({
  name,
  price,
  period,
  description,
  features,
  highlighted,
}: {
  name: string;
  price: string;
  period?: string;
  description: string;
  features: string[];
  highlighted?: boolean;
}) {
  return (
    <div
      className={`relative p-8 rounded-3xl border transition-all duration-300 hover:scale-[1.02] ${
        highlighted
          ? 'bg-gradient-to-b from-blue-500/10 via-indigo-500/8 to-transparent border-blue-500/25'
          : 'bg-zinc-900/30 border-white/10'
      }`}
    >
      {highlighted && (
        <div className="absolute -top-3 left-1/2 -translate-x-1/2 px-4 py-1 bg-gradient-to-r from-blue-400 via-indigo-400 to-violet-400 text-black text-xs font-semibold rounded-full">
          Populaire
        </div>
      )}
      <div className="mb-6">
        <h3 className="text-xl font-semibold text-white mb-1">{name}</h3>
        <p className="text-sm text-zinc-500">{description}</p>
      </div>
      <div className="mb-6">
        <span className="text-4xl font-bold text-white">{price}</span>
        {period && <span className="text-zinc-500">{period}</span>}
      </div>
      <ul className="space-y-3 mb-8">
        {features.map((feature, i) => (
          <li key={i} className="flex items-center gap-3 text-sm text-zinc-300">
            <Check className={`w-5 h-5 ${highlighted ? 'text-blue-300' : 'text-zinc-500'}`} />
            {feature}
          </li>
        ))}
      </ul>
      <Link
        href="/signup"
        className={`block w-full py-3 rounded-xl text-center font-medium transition-all ${
          highlighted ? 'bg-white text-black hover:bg-zinc-100' : 'bg-zinc-800 text-white hover:bg-zinc-700'
        }`}
      >
        Commencer
      </Link>
    </div>
  );
}
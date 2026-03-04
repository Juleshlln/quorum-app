'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import {
  ArrowRight,
  Sparkles,
  BarChart3,
  TrendingUp,
  FileText,
  Zap,
  Menu,
  X,
  Check,
  MessageCircle,
  EyeOff,
} from 'lucide-react';
import { QuorumLogo } from '@/components/logo';

/* ─────────────────────────────────────────────────────────────────────────────
   ROOT PAGE — Quorum Landing
───────────────────────────────────────────────────────────────────────────── */
export default function HomePage() {
  const [scrolled, setScrolled] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 30);
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            entry.target.classList.add('lp-visible');
            observer.unobserve(entry.target);
          }
        });
      },
      { threshold: 0.08, rootMargin: '0px 0px -40px 0px' }
    );
    document.querySelectorAll('[data-lp-animate]').forEach((el) => observer.observe(el));
    return () => observer.disconnect();
  }, []);

  return (
    <div className="min-h-screen bg-[#0A0A0F] text-white overflow-x-hidden">
      {/* Ambient glows */}
      <div className="fixed inset-0 pointer-events-none overflow-hidden" aria-hidden="true">
        <div className="absolute -top-60 left-1/4 w-[800px] h-[800px] bg-blue-600/[0.08] rounded-full blur-[160px]" />
        <div className="absolute top-1/2 -right-60 w-[600px] h-[600px] bg-indigo-600/[0.06] rounded-full blur-[140px]" />
        <div className="absolute bottom-20 -left-40 w-[500px] h-[500px] bg-blue-500/[0.04] rounded-full blur-[120px]" />
      </div>

      {/* ════════════════════════════════════
          1. NAVBAR
      ════════════════════════════════════ */}
      <header
        className={`fixed top-0 left-0 right-0 z-50 transition-all duration-500 ${
          scrolled
            ? 'bg-[#0A0A0F]/90 backdrop-blur-xl border-b border-white/[0.06]'
            : 'bg-transparent'
        }`}
      >
        <div className="max-w-7xl mx-auto px-6 py-4 flex items-center justify-between">
          <Link href="/" className="flex-shrink-0">
            <QuorumLogo className="text-2xl" />
          </Link>

          {/* Desktop nav — hidden on mobile */}
          <nav className="hidden md:flex items-center gap-8">
            {[
              { label: 'Fonctionnalités', href: '#features' },
              { label: 'Tarifs', href: '#pricing' },
              { label: 'À propos', href: '#about' },
            ].map(({ label, href }) => (
              <Link
                key={href}
                href={href}
                className="text-sm text-zinc-400 hover:text-white transition-colors duration-200"
              >
                {label}
              </Link>
            ))}
          </nav>

          {/* Desktop CTAs — hidden on mobile */}
          <div className="hidden md:flex items-center gap-4">
            <Link
              href="/login"
              className="text-sm text-zinc-400 hover:text-white transition-colors duration-200"
            >
              Connexion
            </Link>
            <Link
              href="/signup"
              className="bg-blue-600 hover:bg-blue-500 text-white text-sm font-semibold px-5 py-2.5 rounded-xl transition-all duration-200 hover:shadow-[0_0_28px_rgba(59,130,246,0.5)]"
            >
              Démarrer gratuitement
            </Link>
          </div>

          {/* Hamburger — mobile only */}
          <button
            className="md:hidden text-zinc-400 hover:text-white transition-colors p-1.5"
            onClick={() => setMobileOpen(!mobileOpen)}
            aria-label={mobileOpen ? 'Fermer le menu' : 'Ouvrir le menu'}
          >
            {mobileOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
          </button>
        </div>

        {/* Mobile menu */}
        {mobileOpen && (
          <div className="md:hidden bg-[#111118] border-b border-white/[0.06] px-6 py-5 space-y-1">

            {[
              { label: 'Fonctionnalités', href: '#features' },
              { label: 'Tarifs', href: '#pricing' },
              { label: 'À propos', href: '#about' },
            ].map(({ label, href }) => (
              <Link
                key={href}
                href={href}
                className="block text-sm text-zinc-300 py-2.5 hover:text-white transition-colors"
                onClick={() => setMobileOpen(false)}
              >
                {label}
              </Link>
            ))}
            <div className="pt-4 border-t border-white/[0.06] flex flex-col gap-2">
              <Link
                href="/login"
                className="block text-sm text-zinc-400 py-2 hover:text-white transition-colors"
                onClick={() => setMobileOpen(false)}
              >
                Connexion
              </Link>
              <Link
                href="/signup"
                className="block text-center bg-blue-600 text-white text-sm font-semibold px-5 py-3 rounded-xl hover:bg-blue-500 transition-colors"
                onClick={() => setMobileOpen(false)}
              >
                Démarrer gratuitement
              </Link>
            </div>
          </div>
        )}
      </header>

      {/* ════════════════════════════════════
          2. HERO
      ════════════════════════════════════ */}
      <section className="relative min-h-screen flex flex-col items-center justify-center px-6 pt-32 pb-20 text-center">
        <div className="max-w-5xl mx-auto w-full">
          {/* Badge */}
          <div
            data-lp-animate
            className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-blue-500/10 border border-blue-500/[0.25] mb-8 delay-0"
          >
            <Sparkles className="w-3.5 h-3.5 text-blue-400 flex-shrink-0" />
            <span className="text-xs text-blue-300 font-medium tracking-wide">
              Nouveau — Tracking IA pour les marques B2B
            </span>
          </div>

          {/* H1 */}
          <h1
            data-lp-animate
            className="text-5xl md:text-7xl font-black leading-tight tracking-tight mb-6 delay-100"
          >
            Votre marque apparaît-elle quand
            <br className="hidden sm:block" />
            <span className="text-blue-500">
              {' '}vos clients interrogent l&apos;IA&nbsp;?
            </span>
          </h1>

          {/* Subtitle */}
          <p
            data-lp-animate
            className="text-lg md:text-xl text-zinc-400 max-w-2xl mx-auto leading-relaxed mb-10 delay-150"
          >
            Quorum mesure votre visibilité dans ChatGPT, Claude et Perplexity.
            <br className="hidden md:block" />
            Suivez vos concurrents. Optimisez votre présence IA.
          </p>

          {/* CTAs — même taille, même hauteur */}
          <div
            data-lp-animate
            className="flex flex-wrap gap-4 justify-center items-center mb-10 delay-200"
          >
            <Link
              href="/signup"
              className="flex items-center justify-center gap-2 bg-blue-600 hover:bg-blue-500 text-white px-8 py-4 rounded-xl text-lg font-semibold transition-all duration-200 hover:shadow-[0_0_44px_rgba(59,130,246,0.55)]"
            >
              Démarrer gratuitement
              <ArrowRight className="w-5 h-5" />
            </Link>
            <Link
              href="/dashboard"
              className="flex items-center justify-center px-8 py-4 rounded-xl text-lg font-semibold text-white border border-white/20 hover:border-white/40 transition-all duration-200"
            >
              Voir la démo
            </Link>
          </div>

          {/* Social proof */}
          <p data-lp-animate className="text-sm text-zinc-600 delay-300">
            Déjà utilisé par des équipes marketing B2B
          </p>
        </div>

        {/* Dashboard mockup avec frame glow */}
        <div
          data-lp-animate
          className="max-w-5xl mx-auto w-full mt-20 rounded-2xl border border-white/10 bg-zinc-900/60 backdrop-blur-sm overflow-hidden shadow-2xl shadow-blue-500/10 p-1"
          style={{ transitionDelay: '400ms' }}
        >
          <DashboardMockup />
        </div>
      </section>

      {/* ════════════════════════════════════
          3. METRICS BAR
      ════════════════════════════════════ */}
      <section className="py-14 px-6 bg-[#111118] border-y border-white/[0.06]">
        <div
          data-lp-animate
          className="max-w-6xl mx-auto grid grid-cols-2 md:grid-cols-4 gap-8 text-center"
        >
          <MetricStat value="500+" label="Prompts analysés" />
          <MetricStat value="10+" label="Modèles IA trackés" />
          <MetricStat value="5 min" label="Setup initial" />
          <MetricStat value="24 h" label="Premiers résultats" />
        </div>
      </section>

      {/* ════════════════════════════════════
          4. PAIN POINTS
      ════════════════════════════════════ */}
      <section className="py-24 px-6 border-t border-white/5">
        <div className="max-w-6xl mx-auto">
          <div data-lp-animate className="text-center mb-16">
            <h2 className="text-3xl md:text-[2.6rem] font-bold tracking-tight leading-tight mb-4">
              L&apos;IA change comment vos clients vous trouvent
            </h2>
            <p className="text-zinc-400 max-w-xl mx-auto">
              Les comportements de recherche évoluent. Êtes-vous visible là où ça compte&nbsp;?
            </p>
          </div>

          <div className="grid md:grid-cols-3 gap-6">
            <PainCard
              icon={<MessageCircle className="w-5 h-5 text-blue-400" />}
              title="Vos clients demandent à ChatGPT, pas à Google"
              description="40 % des recherches B2B passent maintenant par des assistants IA. Google n'est plus le seul canal à optimiser."
              delay={0}
            />
            <PainCard
              icon={<TrendingUp className="w-5 h-5 text-blue-400" />}
              title="Vos concurrents sont cités, vous non"
              description="Pendant que vous optimisez votre SEO, vos concurrents capturent les recommandations des IA génératives."
              delay={100}
            />
            <PainCard
              icon={<EyeOff className="w-5 h-5 text-blue-400" />}
              title="Vous ne savez pas ce que l'IA dit de vous"
              description="Sans monitoring, vous pilotez à l'aveugle. L'IA peut décrire votre marque très différemment de ce que vous pensez."
              delay={200}
            />
          </div>
        </div>
      </section>

      {/* ════════════════════════════════════
          5. FEATURES (alternating)
      ════════════════════════════════════ */}
      <section id="features" className="py-24 px-6 border-t border-white/5 bg-[#0D0D14]">
        <div className="max-w-6xl mx-auto">
          <div data-lp-animate className="text-center mb-20">
            <h2 className="text-3xl md:text-[2.6rem] font-bold tracking-tight leading-tight mb-4">
              Quorum vous donne la visibilité complète
            </h2>
            <p className="text-zinc-400 max-w-xl mx-auto">
              Tout ce qu&apos;il faut pour piloter votre présence IA au quotidien
            </p>
          </div>

          <FeatureRow
            eyebrow="Monitoring quotidien"
            title="Chaque jour, Quorum interroge les IA avec vos prompts clés"
            description="Mesures automatiques de vos citations dans ChatGPT, Claude et Perplexity. Alertes en temps réel si votre score chute ou si un concurrent vous dépasse."
            visual={<TopicsCard />}
            reverse={false}
            last={false}
          />
          <FeatureRow
            eyebrow="Competitive Snapshot"
            title="Comparez votre visibilité à celle de vos concurrents en temps réel"
            description="Voyez exactement où vous êtes cité plus souvent que vos rivaux — et où vous perdez du terrain. Benchmark permanent, mis à jour chaque jour."
            visual={<CompetitiveChart />}
            reverse={true}
            last={false}
          />
          <FeatureRow
            eyebrow="Audit PDF exportable"
            title="Générez un rapport professionnel en 1 clic pour votre direction"
            description="KPIs consolidés, graphiques d'évolution, analyse concurrentielle. Un document prêt à partager avec votre COMEX ou vos clients."
            visual={<PDFPreview />}
            reverse={false}
            last={false}
          />
          <FeatureRow
            eyebrow="Recommandations actionnables"
            title="Quorum identifie les prompts où vous perdez face à vos concurrents"
            description="Pour chaque prompt, comprenez pourquoi vous êtes mentionné ou non, et quelle action corrective vous donnera le plus d'impact."
            visual={<InsightsCard />}
            reverse={true}
            last={true}
          />
        </div>
      </section>

      {/* ════════════════════════════════════
          6. HOW IT WORKS
      ════════════════════════════════════ */}
      <section id="how-it-works" className="py-24 px-6 border-t border-white/5">
        <div className="max-w-5xl mx-auto">
          <div data-lp-animate className="text-center mb-20">
            <h2 className="text-3xl md:text-[2.6rem] font-bold tracking-tight leading-tight mb-4">
              Opérationnel en 3 étapes
            </h2>
            <p className="text-zinc-400">Setup en 5 minutes, résultats dès le lendemain matin</p>
          </div>

          <div className="grid md:grid-cols-3 gap-10 relative">
            {/* Connector — desktop only */}
            <div
              className="hidden md:block absolute top-7 h-px border-t border-dashed border-white/10"
              style={{ left: 'calc(16.7% + 2.5rem)', right: 'calc(16.7% + 2.5rem)' }}
              aria-hidden="true"
            />
            <HowStep
              number={1}
              title="Configurez vos prompts"
              description="Ajoutez les questions que posent vos clients à l'IA — ciblées sur votre secteur et vos cas d'usage B2B."
              delay={0}
            />
            <HowStep
              number={2}
              title="Quorum analyse"
              description="Interrogation quotidienne automatique de ChatGPT, Claude et Perplexity. Aucune intervention de votre part."
              delay={150}
            />
            <HowStep
              number={3}
              title="Pilotez votre visibilité"
              description="Dashboard temps réel, alertes e-mail et exports PDF. Agissez vite sur ce qui compte vraiment."
              delay={300}
            />
          </div>
        </div>
      </section>

      {/* ════════════════════════════════════
          7. PRICING
      ════════════════════════════════════ */}
      <section id="pricing" className="py-24 px-6 border-t border-white/5 bg-[#0D0D14]">
        <div className="max-w-6xl mx-auto">
          <div data-lp-animate className="text-center mb-16">
            <h2 className="text-3xl md:text-[2.6rem] font-bold tracking-tight leading-tight mb-4">
              Simple et transparent
            </h2>
            <p className="text-zinc-400">Commencez gratuitement, évoluez selon vos besoins</p>
          </div>

          <div className="grid md:grid-cols-3 gap-6 max-w-5xl mx-auto items-start">
            <PricingCard
              name="Starter"
              price="Gratuit"
              description="Pour découvrir Quorum"
              features={[
                '5 prompts',
                '1 marque suivie',
                'Rapport hebdomadaire',
                'ChatGPT uniquement',
              ]}
              ctaLabel="Commencer gratuitement"
              ctaHref="/signup"
              delay={0}
            />
            <PricingCard
              name="Pro"
              price="€99"
              period="/mois"
              description="Pour les équipes marketing ambitieuses"
              features={[
                '25 prompts',
                '5 concurrents trackés',
                'Rapport quotidien + PDF',
                'Export CSV',
                'ChatGPT, Claude & Perplexity',
                'Alertes par e-mail',
              ]}
              ctaLabel="Démarrer l'essai"
              ctaHref="/signup"
              highlighted
              badge="Populaire"
              delay={100}
            />
            <PricingCard
              name="Enterprise"
              price="Sur devis"
              description="Pour les grandes organisations"
              features={[
                'Prompts illimités',
                'Multi-marques',
                'Accès API',
                'Support dédié',
                'SSO / SAML',
                'SLA garanti',
              ]}
              ctaLabel="Nous contacter"
              ctaHref="/contact"
              delay={200}
            />
          </div>
        </div>
      </section>

      {/* ════════════════════════════════════
          8. FINAL CTA
      ════════════════════════════════════ */}
      <section className="py-32 px-6 border-t border-white/5">
        <div data-lp-animate className="max-w-4xl mx-auto">
          <div className="relative rounded-3xl overflow-hidden">
            <div className="absolute inset-0 bg-gradient-to-br from-blue-700 via-blue-600 to-indigo-700" />
            <div className="absolute inset-0 bg-[radial-gradient(ellipse_80%_60%_at_20%_20%,rgba(255,255,255,0.15),transparent)]" />

            <div className="relative px-8 py-24 text-center">
              <h2 className="text-3xl md:text-5xl font-bold tracking-tight text-white mb-5 leading-tight">
                Commencez à tracker votre visibilité IA
                <br className="hidden sm:block" />
                dès aujourd&apos;hui
              </h2>
              <p className="text-blue-100/80 text-lg mb-10 max-w-lg mx-auto">
                Setup en 5 minutes. Premiers résultats dès demain matin.
              </p>
              <Link
                href="/signup"
                className="group inline-flex items-center gap-2 bg-white text-blue-700 font-bold px-10 py-4 rounded-xl text-lg shadow-lg shadow-black/20 hover:bg-blue-50 transition-all duration-200"
              >
                Créer mon compte gratuit
                <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform duration-200" />
              </Link>
              <p className="mt-5 text-sm text-blue-200/50">
                Aucune carte bancaire requise
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* ════════════════════════════════════
          9. FOOTER
      ════════════════════════════════════ */}
      <footer className="border-t border-white/[0.06] py-12 px-6">
        <div className="max-w-6xl mx-auto flex flex-col md:flex-row items-start md:items-center justify-between gap-8">
          <div>
            <Link href="/" className="inline-block mb-2.5">
              <QuorumLogo className="text-xl" />
            </Link>
            <p className="text-sm text-zinc-600">Visibilité IA pour les marques B2B</p>
          </div>

          <nav className="flex flex-wrap gap-x-8 gap-y-2 text-sm text-zinc-500">
            <Link href="#features" className="hover:text-white transition-colors">Fonctionnalités</Link>
            <Link href="#pricing" className="hover:text-white transition-colors">Tarifs</Link>
            <Link href="/blog" className="hover:text-white transition-colors">Blog</Link>
            <Link href="/contact" className="hover:text-white transition-colors">Contact</Link>
          </nav>

          <p className="text-sm text-zinc-700">© 2026 Quorum. Tous droits réservés.</p>
        </div>
      </footer>
    </div>
  );
}

/* ─────────────────────────────────────────────────────────────────────────────
   SECTION COMPONENTS
───────────────────────────────────────────────────────────────────────────── */

function MetricStat({ value, label }: { value: string; label: string }) {
  return (
    <div>
      <div className="text-3xl md:text-4xl font-bold text-white mb-1.5 tabular-nums">{value}</div>
      <div className="text-sm text-zinc-500">{label}</div>
    </div>
  );
}

function PainCard({
  icon,
  title,
  description,
  delay,
}: {
  icon: React.ReactNode;
  title: string;
  description: string;
  delay: number;
}) {
  return (
    <div
      data-lp-animate
      style={{ transitionDelay: `${delay}ms` }}
      className="p-8 rounded-2xl bg-zinc-900/40 border border-white/[0.08] hover:border-white/20 transition-colors duration-300"
    >
      <div className="w-10 h-10 rounded-xl bg-blue-600/20 border border-blue-500/20 flex items-center justify-center mb-5">
        {icon}
      </div>
      <h3 className="text-base font-semibold text-white mb-2.5 leading-snug">{title}</h3>
      <p className="text-sm text-zinc-400 leading-relaxed">{description}</p>
    </div>
  );
}

function FeatureRow({
  eyebrow,
  title,
  description,
  visual,
  reverse,
  last,
}: {
  eyebrow: string;
  title: string;
  description: string;
  visual: React.ReactNode;
  reverse: boolean;
  last: boolean;
}) {
  return (
    <div
      data-lp-animate
      className={`grid grid-cols-1 lg:grid-cols-2 gap-16 items-center py-16 ${
        !last ? 'border-b border-white/5' : ''
      }`}
    >
      <div className={reverse ? 'lg:order-2' : ''}>
        <span className="text-xs font-bold tracking-widest text-blue-400 uppercase mb-3 block">
          {eyebrow}
        </span>
        <h3 className="text-3xl font-bold text-white leading-snug mb-4">{title}</h3>
        <p className="text-zinc-400 text-lg leading-relaxed">{description}</p>
      </div>
      <div className={`${reverse ? 'lg:order-1' : ''} rounded-2xl border border-white/10 bg-zinc-900/50 p-4 shadow-xl shadow-black/40`}>
        {visual}
      </div>
    </div>
  );
}

function HowStep({
  number,
  title,
  description,
  delay,
}: {
  number: number;
  title: string;
  description: string;
  delay: number;
}) {
  return (
    <div data-lp-animate style={{ transitionDelay: `${delay}ms` }} className="text-center relative">
      <div className="w-14 h-14 mx-auto rounded-full bg-blue-600/20 border border-blue-500/30 flex items-center justify-center mb-6">
        <span className="text-xl font-bold text-blue-400">{number}</span>
      </div>
      <h3 className="text-lg font-semibold text-white mb-3">{title}</h3>
      <p className="text-sm text-zinc-400 leading-relaxed max-w-xs mx-auto">{description}</p>
    </div>
  );
}

function PricingCard({
  name,
  price,
  period,
  description,
  features,
  ctaLabel,
  ctaHref,
  highlighted,
  badge,
  delay,
}: {
  name: string;
  price: string;
  period?: string;
  description: string;
  features: string[];
  ctaLabel: string;
  ctaHref: string;
  highlighted?: boolean;
  badge?: string;
  delay: number;
}) {
  return (
    /* outer div carries the scroll animation; inner div carries the scale */
    <div data-lp-animate style={{ transitionDelay: `${delay}ms` }}>
      <div
        className={`relative flex flex-col h-full p-8 rounded-2xl transition-all duration-300 ${
          highlighted
            ? 'bg-gradient-to-b from-blue-950/80 to-zinc-900/80 border-2 border-blue-500/50 shadow-[0_0_60px_rgba(59,130,246,0.15)] scale-105'
            : 'bg-zinc-900/40 border border-white/10 hover:border-white/20'
        }`}
      >
        {badge && (
          <div className="absolute -top-4 left-1/2 -translate-x-1/2 px-4 py-1 bg-blue-600 text-white text-xs font-bold rounded-full shadow-[0_0_20px_rgba(59,130,246,0.5)] whitespace-nowrap">
            {badge}
          </div>
        )}
        <div className="mb-6">
          <h3 className="text-lg font-semibold text-white mb-1">{name}</h3>
          <p className="text-sm text-zinc-500">{description}</p>
        </div>
        <div className="mb-6 flex items-baseline gap-1">
          <span className="text-4xl font-bold text-white tabular-nums">{price}</span>
          {period && <span className="text-zinc-500 text-sm">{period}</span>}
        </div>
        <ul className="space-y-3 mb-8 flex-1">
          {features.map((f, i) => (
            <li key={i} className="flex items-start gap-3 text-sm text-zinc-300">
              <Check
                className={`w-4 h-4 mt-0.5 flex-shrink-0 ${
                  highlighted ? 'text-blue-400' : 'text-zinc-600'
                }`}
              />
              {f}
            </li>
          ))}
        </ul>
        <Link
          href={ctaHref}
          className={`mt-auto block w-full text-center py-3 rounded-xl font-medium text-sm transition-all duration-200 ${
            highlighted
              ? 'bg-blue-600 text-white hover:bg-blue-500 hover:shadow-[0_0_30px_rgba(59,130,246,0.45)]'
              : 'border border-white/20 text-white hover:bg-white/5 hover:border-white/30'
          }`}
        >
          {ctaLabel}
        </Link>
      </div>
    </div>
  );
}

/* ─────────────────────────────────────────────────────────────────────────────
   VISUAL MOCKUP COMPONENTS
───────────────────────────────────────────────────────────────────────────── */

function DashboardMockup() {
  const bars = [38, 52, 44, 60, 54, 68, 72, 66, 78, 74, 80, 77];
  const competitors = [45, 48, 47, 50, 48, 50, 52, 50, 51, 54, 53, 55];

  return (
    <div className="relative rounded-xl border border-white/[0.06] bg-[#111118] overflow-hidden">
      <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-blue-500/40 to-transparent" />

      {/* Browser chrome */}
      <div className="flex items-center gap-2 px-4 py-3 border-b border-white/[0.05] bg-[#0D0D14]">
        <div className="flex gap-1.5">
          <div className="w-2.5 h-2.5 rounded-full bg-red-500/70" />
          <div className="w-2.5 h-2.5 rounded-full bg-yellow-500/70" />
          <div className="w-2.5 h-2.5 rounded-full bg-green-500/70" />
        </div>
        <div className="flex-1 flex justify-center">
          <div className="bg-white/[0.04] rounded px-4 py-1 text-xs text-zinc-500 font-mono">
            app.quorum.ai/overview
          </div>
        </div>
      </div>

      <div className="p-5 md:p-6">
        {/* KPI row */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-5">
          {[
            { label: 'Score visibilité', value: '74 %', badge: '↑ 12 %', good: true },
            { label: 'Citations', value: '234', badge: '↑ 34', good: true },
            { label: 'Prompts actifs', value: '18', badge: 'stable', good: null },
            { label: 'Concurrents', value: '5', badge: '', good: null },
          ].map((kpi, i) => (
            <div key={i} className="bg-[#0A0A0F] rounded-xl border border-white/[0.05] p-3.5">
              <p className="text-xs text-zinc-500 mb-1.5">{kpi.label}</p>
              <p className="text-xl font-bold text-white tabular-nums">{kpi.value}</p>
              {kpi.badge && (
                <p className={`text-xs mt-1 ${kpi.good === true ? 'text-green-400' : 'text-zinc-600'}`}>
                  {kpi.badge}
                </p>
              )}
            </div>
          ))}
        </div>

        {/* Chart */}
        <div className="bg-[#0A0A0F] rounded-xl border border-white/[0.05] p-4 md:p-5">
          <div className="flex items-center justify-between mb-4">
            <p className="text-sm font-medium text-white">Visibilité vs Concurrents — 30 jours</p>
            <span className="text-xs text-zinc-600">Mise à jour il y a 2 h</span>
          </div>
          <div className="relative h-28 md:h-36">
            <svg viewBox="0 0 480 100" className="w-full h-full" preserveAspectRatio="none">
              <defs>
                <linearGradient id="lg-brand" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#3B82F6" stopOpacity="0.35" />
                  <stop offset="100%" stopColor="#3B82F6" stopOpacity="0" />
                </linearGradient>
              </defs>
              {[25, 50, 75].map((y) => (
                <line key={y} x1="0" y1={y} x2="480" y2={y} stroke="rgba(255,255,255,0.04)" strokeWidth="1" />
              ))}
              <polyline
                points={competitors.map((v, i) => `${(i / (competitors.length - 1)) * 480},${100 - v}`).join(' ')}
                fill="none" stroke="#6366F1" strokeWidth="1.5" strokeDasharray="5,3" opacity="0.7"
              />
              <polygon
                points={[...bars.map((v, i) => `${(i / (bars.length - 1)) * 480},${100 - v}`), '480,100', '0,100'].join(' ')}
                fill="url(#lg-brand)"
              />
              <polyline
                points={bars.map((v, i) => `${(i / (bars.length - 1)) * 480},${100 - v}`).join(' ')}
                fill="none" stroke="#3B82F6" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
              />
              <circle cx="480" cy={100 - bars[bars.length - 1]} r="3.5" fill="#3B82F6" />
            </svg>
          </div>
          <div className="flex items-center gap-6 mt-3">
            <div className="flex items-center gap-2">
              <div className="w-5 h-0.5 bg-blue-500 rounded-full" />
              <span className="text-xs text-zinc-400">Votre marque</span>
            </div>
            <div className="flex items-center gap-2">
              <svg width="20" height="4" viewBox="0 0 20 4" aria-hidden="true">
                <line x1="0" y1="2" x2="20" y2="2" stroke="#6366F1" strokeWidth="1.5" strokeDasharray="5,3" />
              </svg>
              <span className="text-xs text-zinc-400">Concurrent #1</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function TopicsCard() {
  const topics = [
    { label: 'Fournitures bureau', score: 82, trend: '+8 %', up: true },
    { label: 'Équipements sécurité', score: 67, trend: '+3 %', up: true },
    { label: 'Outillage professionnel', score: 45, trend: '-2 %', up: false },
    { label: 'Mobilier ergonomique', score: 71, trend: '+11 %', up: true },
  ];
  return (
    <div className="bg-[#0A0A0F] rounded-xl p-5">
      <div className="flex items-center gap-2 mb-5">
        <BarChart3 className="w-4 h-4 text-blue-400" />
        <span className="text-sm font-medium text-white">Topics actifs</span>
        <span className="ml-auto text-xs text-green-400 bg-green-400/10 px-2.5 py-0.5 rounded-full">Live</span>
      </div>
      <div className="space-y-4">
        {topics.map((t, i) => (
          <div key={i}>
            <div className="flex items-center justify-between mb-1.5">
              <span className="text-xs text-zinc-400">{t.label}</span>
              <div className="flex items-center gap-2">
                <span className={`text-xs font-medium ${t.up ? 'text-green-400' : 'text-red-400'}`}>{t.trend}</span>
                <span className="text-xs font-bold text-white tabular-nums">{t.score} %</span>
              </div>
            </div>
            <div className="h-1.5 bg-white/[0.06] rounded-full overflow-hidden">
              <div
                className="h-full bg-gradient-to-r from-blue-500 to-indigo-500 rounded-full"
                style={{ width: `${t.score}%` }}
              />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function CompetitiveChart() {
  const brands: { name: string; score: number; color: string }[] = [
    { name: 'Votre marque', score: 74, color: '#3B82F6' },
    { name: 'Concurrent A', score: 58, color: '#6366F1' },
    { name: 'Concurrent B', score: 41, color: '#8B5CF6' },
    { name: 'Concurrent C', score: 33, color: '#A78BFA' },
    { name: 'Concurrent D', score: 22, color: '#C4B5FD' },
  ];
  return (
    <div className="bg-[#0A0A0F] rounded-xl p-5">
      <div className="flex items-center gap-2 mb-5">
        <TrendingUp className="w-4 h-4 text-indigo-400" />
        <span className="text-sm font-medium text-white">Competitive Snapshot</span>
        <span className="ml-auto text-xs text-zinc-600">Aujourd'hui</span>
      </div>
      <div className="space-y-3.5">
        {brands.map((b, i) => (
          <div key={i} className="flex items-center gap-3">
            <span className={`text-xs w-28 truncate flex-shrink-0 ${i === 0 ? 'text-white font-medium' : 'text-zinc-400'}`}>
              {b.name}
            </span>
            <div className="flex-1 h-7 bg-white/[0.03] rounded-lg overflow-hidden relative border border-white/[0.04]">
              <div
                className="h-full rounded-lg"
                style={{ width: `${b.score}%`, backgroundColor: `${b.color}22`, borderRight: `2px solid ${b.color}66` }}
              />
              <span className="absolute right-2.5 top-1/2 -translate-y-1/2 text-xs font-semibold text-white tabular-nums">
                {b.score} %
              </span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function PDFPreview() {
  return (
    <div className="bg-[#0A0A0F] rounded-xl p-5">
      <div className="flex items-center gap-2 mb-5">
        <FileText className="w-4 h-4 text-green-400" />
        <span className="text-sm font-medium text-white">Rapport Mensuel — Manutan</span>
        <span className="ml-auto text-xs text-zinc-600 bg-zinc-800 px-2 py-0.5 rounded font-mono">PDF</span>
      </div>
      <div className="bg-white/[0.03] rounded-xl border border-white/[0.05] p-4 space-y-4">
        <div className="flex items-center justify-between">
          <span className="text-xs text-zinc-500">Score global</span>
          <span className="text-2xl font-bold text-white tabular-nums">74 / 100</span>
        </div>
        <div className="h-px bg-white/[0.05]" />
        <div className="grid grid-cols-2 gap-3">
          {[
            { label: 'Visibilité', val: '77 %', good: true },
            { label: 'Part de citation', val: '34 %', good: true },
            { label: 'Concurrents battus', val: '3 / 5', good: null },
            { label: 'Prompts gagnants', val: '12', good: true },
          ].map((k, i) => (
            <div key={i} className="bg-white/[0.03] rounded-lg p-3 border border-white/[0.04]">
              <p className="text-xs text-zinc-500 mb-1">{k.label}</p>
              <p className={`text-lg font-bold tabular-nums ${k.good ? 'text-green-400' : 'text-white'}`}>{k.val}</p>
            </div>
          ))}
        </div>
        <button className="w-full flex items-center justify-center gap-2 py-2.5 rounded-lg border border-white/[0.08] text-xs text-zinc-400 hover:text-white hover:border-white/20 transition-colors">
          <FileText className="w-3.5 h-3.5" />
          Télécharger le PDF
        </button>
      </div>
    </div>
  );
}

function InsightsCard() {
  return (
    <div className="bg-[#0A0A0F] rounded-xl p-5">
      <div className="flex items-center gap-2 mb-5">
        <Zap className="w-4 h-4 text-yellow-400" />
        <span className="text-sm font-medium text-white">Pourquoi vous gagnez / perdez</span>
      </div>
      <div className="space-y-3">
        <div className="p-4 rounded-xl bg-green-500/[0.05] border border-green-500/[0.15]">
          <div className="flex items-center gap-2 mb-2">
            <div className="w-2 h-2 rounded-full bg-green-400 flex-shrink-0" />
            <span className="text-xs font-semibold text-green-300 uppercase tracking-wide">Vous gagnez</span>
          </div>
          <p className="text-xs text-zinc-300 mb-1.5">&ldquo;meilleur fournisseur fournitures bureau B2B&rdquo;</p>
          <p className="text-xs text-green-400/70">Cité en 1re position dans 8 / 10 réponses</p>
        </div>
        <div className="p-4 rounded-xl bg-red-500/[0.05] border border-red-500/[0.15]">
          <div className="flex items-center gap-2 mb-2">
            <div className="w-2 h-2 rounded-full bg-red-400 flex-shrink-0" />
            <span className="text-xs font-semibold text-red-300 uppercase tracking-wide">Vous perdez</span>
          </div>
          <p className="text-xs text-zinc-300 mb-1.5">&ldquo;outillage professionnel pour PME&rdquo;</p>
          <p className="text-xs text-red-400/70">Concurrent A cité 3× plus souvent</p>
        </div>
        <div className="p-4 rounded-xl bg-blue-500/[0.05] border border-blue-500/[0.15]">
          <div className="flex items-center gap-2 mb-2">
            <Zap className="w-3.5 h-3.5 text-blue-400 flex-shrink-0" />
            <span className="text-xs font-semibold text-blue-300 uppercase tracking-wide">Action recommandée</span>
          </div>
          <p className="text-xs text-zinc-300">
            Créer du contenu sur &ldquo;outillage PME&rdquo; — potentiel +18 % de score
          </p>
        </div>
      </div>
    </div>
  );
}

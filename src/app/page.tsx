'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import {
  ArrowRight,
  BarChart3,
  TrendingUp,
  FileText,
  Zap,
  Menu,
  X,
  Check,
  MessageCircle,
  EyeOff,
  Eye,
  Users,
  BadgeEuro,
} from 'lucide-react';
import { QuorumLogo } from '@/components/logo';
import { ThemeToggle } from '@/components/theme/theme-toggle';

/* ─────────────────────────────────────────────────────────────────────────────
   ROOT PAGE — Quorum Landing
───────────────────────────────────────────────────────────────────────────── */
export default function HomePage() {
  const [scrolled, setScrolled] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const navItems = [
    { label: 'Le problème', href: '#probleme' },
    { label: 'Solution', href: '#solution' },
    { label: 'Fonctionnalités', href: '#features' },
    { label: 'Tarifs', href: '#tarifs' },
  ];

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
    <div className="min-h-screen overflow-x-hidden bg-transparent quorum-text-primary">
      {/* Ambient glows */}
      <div className="fixed inset-0 pointer-events-none overflow-hidden" aria-hidden="true">
        <div className="quorum-ambient-grid absolute inset-0 opacity-[0.08]" />
        <div className="absolute -top-52 left-[18%] h-[44rem] w-[44rem] rounded-full bg-blue-600/[0.12] blur-[190px]" />
        <div className="absolute top-[42%] -right-44 h-[34rem] w-[34rem] rounded-full bg-indigo-500/[0.12] blur-[170px]" />
        <div className="absolute bottom-6 -left-32 h-[28rem] w-[28rem] rounded-full bg-blue-500/[0.08] blur-[150px]" />
        <div className="absolute inset-x-[26%] top-[8%] h-[18rem] rounded-full bg-white/[0.04] blur-[120px]" />
      </div>

      {/* ════════════════════════════════════
          1. NAVBAR
      ════════════════════════════════════ */}
      <header
        className={`fixed top-0 left-0 right-0 z-50 transition-all duration-500 ${
          scrolled
            ? 'quorum-shell-panel-strong border-b'
            : 'bg-transparent'
        }`}
        style={scrolled ? {
          borderBottomColor: 'var(--quorum-shell-border)',
        } : undefined}
      >
        <div className="mx-auto flex max-w-[1440px] items-center justify-between px-6 py-4">
          <Link href="/" className="flex-shrink-0">
            <QuorumLogo adaptive className="h-8 w-[168px]" priority />
          </Link>

          {/* Desktop nav — hidden on mobile */}
          <nav className="hidden items-center gap-10 md:flex">
            {navItems.map(({ label, href }) => (
              <Link
                key={href}
                href={href}
                className="text-sm quorum-text-muted hover:quorum-text-primary transition-colors duration-200"
              >
                {label}
              </Link>
            ))}
          </nav>

          {/* Desktop CTAs — hidden on mobile */}
          <div className="hidden items-center gap-3 md:flex">
            <ThemeToggle className="theme-toggle--header" />
            <Link
              href="/login"
              className="text-sm quorum-text-muted hover:quorum-text-primary transition-colors duration-200"
            >
              Connexion
            </Link>
            <Link
              href="/signup"
              className="quorum-btn-primary h-11 rounded-2xl px-5"
            >
              Demander une démo
            </Link>
          </div>

          {/* Hamburger — mobile only */}
          <div className="md:hidden flex items-center gap-2">
            <ThemeToggle className="theme-toggle--header" />
            <button
              className="quorum-text-muted hover:quorum-text-primary transition-colors p-1.5"
              onClick={() => setMobileOpen(!mobileOpen)}
              aria-label={mobileOpen ? 'Fermer le menu' : 'Ouvrir le menu'}
            >
              {mobileOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
            </button>
          </div>
        </div>

        {/* Mobile menu */}
        {mobileOpen && (
          <div className="md:hidden quorum-shell-panel-strong border-b px-6 py-5 space-y-1" style={{ borderBottomColor: 'var(--quorum-shell-border)' }}>
            {navItems.map(({ label, href }) => (
              <Link
                key={href}
                href={href}
                className="block text-sm quorum-text-muted py-2.5 hover:quorum-text-primary transition-colors"
                onClick={() => setMobileOpen(false)}
              >
                {label}
              </Link>
            ))}
            <div className="pt-4 border-t quorum-border-default flex flex-col gap-2">
              <Link
                href="/login"
                className="block text-sm quorum-text-muted py-2 hover:quorum-text-primary transition-colors"
                onClick={() => setMobileOpen(false)}
              >
                Connexion
              </Link>
              <Link
                href="/signup"
                className="quorum-btn-primary block h-12 rounded-2xl px-5 py-3 text-center text-sm"
                onClick={() => setMobileOpen(false)}
              >
                Demander une démo
              </Link>
            </div>
          </div>
        )}
      </header>

      {/* ════════════════════════════════════
          2. HERO
      ════════════════════════════════════ */}
      <section className="relative px-6 pb-24 pt-32 md:pt-36">
        <div className="mx-auto w-full max-w-[1280px]">
          <div className="quorum-dashboard-hero px-6 py-12 md:px-10 md:py-14 lg:px-16 lg:py-16">
            <div className="relative z-[1] mx-auto max-w-5xl text-center">
              <div
                data-lp-animate
                className="quorum-soft-badge mb-8 delay-0"
              >
                <span>
                  Generative Engine Optimization
                </span>
              </div>

              <h1
                data-lp-animate
                className="mb-6 text-5xl font-black leading-[0.94] tracking-[-0.065em] delay-100 md:text-7xl lg:text-[5.4rem]"
              >
                Savez-vous ce que l&apos;IA
                <br className="hidden sm:block" />
                <span className="quorum-gradient-text">
                  {' '}dit de votre marque&nbsp;?
                </span>
              </h1>

              <p
                data-lp-animate
                className="mx-auto mb-10 max-w-3xl text-lg leading-relaxed quorum-text-muted delay-150 md:text-xl"
              >
                58 % des recherches se terminent sans un seul clic. Les réponses IA
                remplacent les résultats classiques. Quorum vous montre si votre marque
                est citée et comment reprendre le contrôle.
              </p>

              <div
                data-lp-animate
                className="flex flex-wrap items-center justify-center gap-3 delay-200"
              >
                <Link
                  href="/signup"
                  className="quorum-btn-primary h-14 rounded-2xl px-8 text-lg"
                >
                  Demander une démo
                  <ArrowRight className="w-5 h-5" />
                </Link>
                <Link
                  href="#solution"
                  className="quorum-btn-secondary h-14 rounded-2xl px-8 text-lg"
                >
                  Comment ça marche
                </Link>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ════════════════════════════════════
          3. LE PROBLEME
      ════════════════════════════════════ */}
      <section id="probleme" className="px-6 py-24 border-t quorum-border-default quorum-surface-strong">
        <div className="mx-auto max-w-[1440px]">
          <div data-lp-animate className="mb-16">
            <h2 className="mb-5 text-3xl font-black leading-tight tracking-[-0.05em] md:text-[3.2rem]">
              L&apos;IA a changé les règles du jeu
            </h2>
            <p className="max-w-xl text-lg quorum-text-muted">
              Vos clients ne cherchent plus comme avant. Votre stratégie de visibilité
              doit évoluer.
            </p>
          </div>

          <div className="grid gap-6 md:grid-cols-3">
            <PainCard
              icon={<MessageCircle className="w-5 h-5 text-blue-400" />}
              title="“Quel est le meilleur fournisseur pour…”"
              description="Vos prospects posent cette question à ChatGPT, Gemini ou Perplexity. Si l&apos;IA ne vous cite pas, vous n&apos;existez pas dans ce nouveau canal."
              delay={0}
            />
            <PainCard
              icon={<TrendingUp className="w-5 h-5 text-blue-400" />}
              title="Vos concurrents captent les recommandations IA"
              description="Pendant que vous optimisez votre SEO classique, vos rivaux sont déjà cités en première position dans les réponses génératives."
              delay={100}
            />
            <PainCard
              icon={<EyeOff className="w-5 h-5 text-blue-400" />}
              title="Vous pilotez à l&apos;aveugle"
              description="Aucun outil ne vous dit comment l&apos;IA décrit votre marque, ni quels leviers actionner pour améliorer votre position."
              delay={200}
            />
          </div>
        </div>
      </section>

      {/* ════════════════════════════════════
          4. IMPACT
      ════════════════════════════════════ */}
      <section className="px-6 py-24 border-t quorum-border-default">
        <div className="mx-auto max-w-[1440px]">
          <div data-lp-animate className="mb-16 text-center">
            <h2 className="mb-5 text-3xl font-black leading-tight tracking-[-0.05em] md:text-[3.2rem]">
              Suivez l&apos;impact réel de l&apos;IA sur votre business
            </h2>
            <p className="mx-auto max-w-3xl text-lg quorum-text-muted">
              Les marques citées par les IA reçoivent un trafic qui convertit jusqu&apos;à 4× mieux.
              Quorum mesure cette corrélation pour votre entreprise, du score de visibilité IA
              jusqu&apos;à son impact sur votre trafic et votre chiffre d&apos;affaires.
            </p>
          </div>

          <div className="relative mx-auto mb-16 grid max-w-5xl gap-10 md:grid-cols-3">
            <div
              className="absolute top-10 hidden border-t border-dashed quorum-border-default md:block"
              style={{ left: 'calc(16.7% + 2.5rem)', right: 'calc(16.7% + 2.5rem)' }}
              aria-hidden="true"
            />
            <ImpactStep
              icon={<Eye className="h-7 w-7 text-blue-300" />}
              title="Score de visibilité"
              description="Quorum mesure votre taux d&apos;apparition dans chaque moteur IA, prompt par prompt."
              delay={0}
            />
            <ImpactStep
              icon={<Users className="h-7 w-7 text-blue-300" />}
              title="Trafic attribué à l&apos;IA"
              description="Identifiez le volume de visiteurs qui arrivent sur votre site grâce aux recommandations des IA."
              delay={120}
            />
            <ImpactStep
              icon={<BadgeEuro className="h-7 w-7 text-blue-300" />}
              title="Revenue attribué"
              description="Mesurez le chiffre d&apos;affaires généré par le canal IA et prouvez le ROI de votre stratégie GEO."
              delay={240}
            />
          </div>

          <div className="mx-auto grid max-w-5xl gap-6 md:grid-cols-3">
            <ProofStat
              value="4.4×"
              label="taux de conversion des visiteurs venant des IA vs SEO classique"
              source="Source : Semrush 2026"
            />
            <ProofStat
              value="+68 %"
              label="de temps passé sur les sites par les visiteurs provenant des IA"
              source="Source : SE Ranking 2026"
            />
            <ProofStat
              value="2×"
              label="plus de clics sortants depuis ChatGPT que depuis une page Google"
              source="Source : Semrush 2026"
            />
          </div>

          <div data-lp-animate className="mt-14 text-center">
            <p className="mx-auto mb-8 max-w-3xl text-lg quorum-text-muted">
              Contrairement aux outils concurrents qui s&apos;arrêtent au monitoring, Quorum trace
              le chemin complet : visibilité IA, trafic sur votre site, conversions, chiffre d&apos;affaires.
              Vous ne pilotez plus un score, vous pilotez un canal d&apos;acquisition.
            </p>
            <Link href="/signup" className="quorum-btn-primary inline-flex h-14 rounded-2xl px-8 text-base">
              Découvrir le suivi d&apos;impact
              <ArrowRight className="w-5 h-5" />
            </Link>
          </div>
        </div>
      </section>

      {/* ════════════════════════════════════
          5. FEATURES (alternating)
      ════════════════════════════════════ */}
      <section id="features" className="py-24 px-6 border-t quorum-border-default quorum-surface-strong">
        <div className="mx-auto max-w-[1440px]">
          <div data-lp-animate className="mb-20">
            <h2 className="mb-4 text-3xl font-black leading-tight tracking-[-0.05em] md:text-[3rem]">
              Quorum vous donne la visibilité complète
            </h2>
            <p className="max-w-xl text-lg quorum-text-muted">
              Tout ce qu&apos;il faut pour piloter votre présence IA au quotidien.
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
          6. SOLUTION
      ════════════════════════════════════ */}
      <section id="solution" className="px-6 py-24 border-t quorum-border-default">
        <div className="mx-auto max-w-[1320px]">
          <div data-lp-animate className="text-center mb-20">
            <h2 className="mb-4 text-3xl font-black leading-tight tracking-[-0.05em] md:text-[3rem]">
              Quorum, votre copilote GEO
            </h2>
            <p className="mx-auto max-w-xl text-lg quorum-text-muted">
              Mesurez, comparez et optimisez votre visibilité dans les moteurs IA, en continu.
            </p>
          </div>

          <div className="grid md:grid-cols-3 gap-10 relative">
            {/* Connector — desktop only */}
            <div
              className="hidden md:block absolute top-7 h-px border-t border-dashed quorum-border-default"
              style={{ left: 'calc(16.7% + 2.5rem)', right: 'calc(16.7% + 2.5rem)' }}
              aria-hidden="true"
            />
            <HowStep
              number={1}
              title="Monitoring quotidien"
              description="Quorum interroge ChatGPT, Claude, Gemini, Perplexity, DeepSeek, Mistral et Llama chaque jour avec vos prompts métier."
              delay={0}
            />
            <HowStep
              number={2}
              title="Benchmark concurrentiel"
              description="Comparez votre visibilité IA à celle de vos concurrents. Identifiez les prompts où vous perdez et ceux où vous dominez."
              delay={150}
            />
            <HowStep
              number={3}
              title="Actions prescriptives"
              description="Recevez des recommandations concrètes pour améliorer votre positionnement IA, priorisées par impact sur votre pipeline."
              delay={300}
            />
          </div>

          <div data-lp-animate className="mt-16 text-center">
            <Link href="/signup" className="quorum-btn-primary inline-flex h-14 rounded-2xl px-8 text-lg">
              Voir Quorum en action
              <ArrowRight className="w-5 h-5" />
            </Link>
          </div>
        </div>
      </section>

      {/* ════════════════════════════════════
          7. STATS
      ════════════════════════════════════ */}
      <section className="border-y quorum-border-default px-6 py-16">
        <div
          data-lp-animate
          className="mx-auto grid max-w-[1440px] grid-cols-2 gap-10 text-center md:grid-cols-4"
        >
          <MetricStat value="7+" label="Moteurs IA couverts" />
          <MetricStat value="58 %" label="De recherches sans clic" />
          <MetricStat value="80 %" label="Des URLs IA hors top 100 Google" />
          <MetricStat value="500+" label="Prompts analysables" />
        </div>
      </section>

      {/* ════════════════════════════════════
          8. PRICING
      ════════════════════════════════════ */}
      <section id="tarifs" className="px-6 py-24 quorum-surface-strong">
        <div className="mx-auto max-w-[1440px]">
          <div data-lp-animate className="mb-16">
            <h2 className="mb-4 text-3xl font-black leading-tight tracking-[-0.05em] md:text-[3rem]">
              Des plans adaptés à chaque étape
            </h2>
            <p className="text-lg quorum-text-muted">
              De la première mesure au déploiement multi-marques.
            </p>
          </div>

          <div className="mx-auto grid max-w-6xl items-start gap-6 md:grid-cols-2 xl:grid-cols-4">
            <PricingCard
              name="Starter"
              price="89€"
              period="/mois"
              description="Pour les équipes qui démarrent leur veille IA."
              features={[
                '15 prompts',
                '2 modèles IA au choix',
                'Tracking quotidien',
                '1 marque',
                'Utilisateurs illimités',
              ]}
              ctaLabel="Demander une démo"
              ctaHref="/signup"
              delay={0}
            />
            <PricingCard
              name="Growth"
              price="229€"
              period="/mois"
              description="Pour les équipes qui pilotent activement leur visibilité IA."
              features={[
                '50 prompts',
                '4 modèles IA au choix',
                'Tracking quotidien',
                '2 marques',
                'Utilisateurs illimités',
              ]}
              ctaLabel="Demander une démo"
              ctaHref="/signup"
              highlighted
              badge="Recommandé"
              delay={100}
            />
            <PricingCard
              name="Pro"
              price="449€"
              period="/mois"
              description="Pour les équipes multi-marques avec un reporting avancé."
              features={[
                '150 prompts',
                '4 modèles IA au choix',
                'Tracking quotidien',
                '3 marques',
                'Support prioritaire',
              ]}
              ctaLabel="Demander une démo"
              ctaHref="/signup"
              delay={200}
            />
            <PricingCard
              name="Enterprise"
              price="Sur devis"
              description="Pour les organisations qui ont besoin d&apos;un déploiement sur mesure."
              features={[
                'Prompts illimités',
                'Marques illimitées',
                'Tous les modèles IA',
                'Accès API avancé',
                'SSO / SAML',
                'SLA garanti',
                'Onboarding personnalisé',
              ]}
              ctaLabel="Nous contacter"
              ctaHref="/signup"
              delay={300}
            />
          </div>
        </div>
      </section>

      {/* ════════════════════════════════════
          9. FINAL CTA
      ════════════════════════════════════ */}
      <section className="px-6 py-28 border-t quorum-border-default">
        <div data-lp-animate className="max-w-4xl mx-auto">
          <div className="quorum-dashboard-hero relative overflow-hidden rounded-[32px]">
            <div className="relative z-[1] px-8 py-24 text-center">
              <h2 className="mb-5 text-3xl font-black leading-tight tracking-[-0.06em] quorum-text-primary md:text-5xl">
                Reprenez le contrôle de votre visibilité
                <br className="hidden sm:block" />
                dans l&apos;IA
              </h2>
              <p className="mx-auto mb-10 max-w-2xl text-lg text-blue-100/80">
                Réservez 30 minutes avec notre équipe. Nous vous montrons exactement
                où votre marque se situe aujourd&apos;hui.
              </p>
              <Link
                href="/signup"
                className="quorum-btn-primary group inline-flex h-14 items-center gap-2 rounded-2xl px-10 text-lg font-bold"
              >
                Planifier ma démo
                <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform duration-200" />
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* ════════════════════════════════════
          9. FOOTER
      ════════════════════════════════════ */}
      <footer className="border-t quorum-border-default py-12 px-6">
        <div className="max-w-6xl mx-auto flex flex-col md:flex-row items-start md:items-center justify-between gap-8">
          <div>
            <Link href="/" className="inline-block mb-2.5">
              <QuorumLogo adaptive className="h-7 w-[150px]" />
            </Link>
            <p className="text-sm quorum-text-subtle">Votre copilote GEO pour l&apos;IA générative</p>
          </div>

          <nav className="flex flex-wrap gap-x-8 gap-y-2 text-sm quorum-text-subtle">
            <Link href="#probleme" className="hover:quorum-text-primary transition-colors">Le problème</Link>
            <Link href="#solution" className="hover:quorum-text-primary transition-colors">Solution</Link>
            <Link href="#features" className="hover:quorum-text-primary transition-colors">Fonctionnalités</Link>
            <Link href="#tarifs" className="hover:quorum-text-primary transition-colors">Tarifs</Link>
          </nav>

          <p className="text-sm quorum-text-soft">© 2026 Quorum. Tous droits réservés.</p>
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
      <div className="mb-1.5 text-3xl font-black tabular-nums quorum-text-primary md:text-4xl">{value}</div>
      <div className="text-sm text-blue-100/62">{label}</div>
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
      className="quorum-panel quorum-panel-hoverable p-8"
    >
      <div className="mb-5 flex h-11 w-11 items-center justify-center rounded-2xl border border-blue-400/20 bg-blue-500/10 shadow-[0_12px_32px_rgba(37,99,235,0.12)]">
        {icon}
      </div>
      <h3 className="text-base font-semibold quorum-text-primary mb-2.5 leading-snug">{title}</h3>
      <p className="text-sm quorum-text-muted leading-relaxed">{description}</p>
    </div>
  );
}

function ImpactStep({
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
      className="relative px-4 py-4 text-center"
    >
      <div className="mx-auto mb-5 flex h-20 w-20 items-center justify-center rounded-full border border-blue-400/18 bg-blue-500/8 shadow-[0_20px_60px_rgba(37,99,235,0.14)]">
        {icon}
      </div>
      <h3 className="mb-2 text-lg font-semibold quorum-text-primary">{title}</h3>
      <p className="mx-auto max-w-xs text-sm leading-relaxed quorum-text-muted">{description}</p>
    </div>
  );
}

function ProofStat({
  value,
  label,
  source,
}: {
  value: string;
  label: string;
  source: string;
}) {
  return (
    <div data-lp-animate className="quorum-panel quorum-panel-hoverable p-6 text-center">
      <div className="mb-2 text-3xl font-black tabular-nums quorum-text-primary">{value}</div>
      <p className="text-sm leading-relaxed quorum-text-muted">{label}</p>
      <p className="mt-2 text-xs quorum-text-subtle">{source}</p>
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
        !last ? 'border-b quorum-border-default' : ''
      }`}
    >
      <div className={reverse ? 'lg:order-2' : ''}>
        <span className="quorum-soft-badge mb-4">
          {eyebrow}
        </span>
        <h3 className="mb-4 text-3xl font-black leading-snug tracking-[-0.05em] quorum-text-primary">{title}</h3>
        <p className="quorum-text-muted text-lg leading-relaxed">{description}</p>
      </div>
      <div className={`${reverse ? 'lg:order-1' : ''} quorum-panel-strong quorum-panel-hoverable rounded-[30px] p-5`}>
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
    <div data-lp-animate style={{ transitionDelay: `${delay}ms` }} className="relative text-center">
      <div className="mx-auto mb-7 flex h-16 w-16 items-center justify-center rounded-full border-2 border-blue-300/18 bg-white/[0.02]">
        <span className="text-2xl font-black text-blue-200">{number}</span>
      </div>
      <h3 className="mb-3 text-lg font-semibold quorum-text-primary">{title}</h3>
      <p className="mx-auto max-w-xs text-sm leading-relaxed quorum-text-muted">{description}</p>
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
        className={`relative flex h-full flex-col rounded-[28px] p-8 transition-all duration-300 ${
          highlighted
            ? 'quorum-dashboard-hero scale-[1.03]'
            : 'quorum-panel quorum-panel-hoverable'
        }`}
      >
        {badge && (
          <div className="absolute -top-4 left-1/2 -translate-x-1/2 whitespace-nowrap rounded-full border border-blue-300/20 bg-blue-500 px-4 py-1 text-xs font-bold quorum-text-primary shadow-[0_0_20px_rgba(59,130,246,0.5)]">
            {badge}
          </div>
        )}
        <div className="mb-6">
          <h3 className="text-lg font-semibold quorum-text-primary mb-1">{name}</h3>
          <p className="text-sm quorum-text-subtle">{description}</p>
        </div>
        <div className="mb-6 flex items-baseline gap-1">
          <span className="text-4xl font-bold quorum-text-primary tabular-nums">{price}</span>
          {period && <span className="quorum-text-subtle text-sm">{period}</span>}
        </div>
        <ul className="space-y-3 mb-8 flex-1">
          {features.map((f, i) => (
            <li key={i} className="flex items-start gap-3 text-sm quorum-text-muted">
              <Check
                className={`w-4 h-4 mt-0.5 flex-shrink-0 ${
                  highlighted ? 'text-blue-400' : 'quorum-text-subtle'
                }`}
              />
              {f}
            </li>
          ))}
        </ul>
        <Link
          href={ctaHref}
          className={`mt-auto block w-full rounded-2xl py-3 text-center text-sm font-medium transition-all duration-200 ${
            highlighted
              ? 'quorum-btn-primary'
              : 'quorum-btn-secondary'
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
    <div className="relative overflow-hidden rounded-[24px] border quorum-border-default quorum-surface-strong">
      <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-blue-500/40 to-transparent" />

      {/* Browser chrome */}
      <div className="flex items-center gap-2 border-b quorum-border-default bg-[#090d16] px-4 py-3">
        <div className="flex gap-1.5">
          <div className="w-2.5 h-2.5 rounded-full bg-red-500/70" />
          <div className="w-2.5 h-2.5 rounded-full bg-yellow-500/70" />
          <div className="w-2.5 h-2.5 rounded-full bg-green-500/70" />
        </div>
        <div className="flex-1 flex justify-center">
          <div className="quorum-surface rounded px-4 py-1 text-xs quorum-text-subtle font-mono">
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
            <div key={i} className="rounded-2xl border quorum-border-default bg-[rgba(8,13,24,0.68)] p-3.5 shadow-[inset_0_1px_0_rgba(255,255,255,0.04)]">
              <p className="text-xs quorum-text-subtle mb-1.5">{kpi.label}</p>
              <p className="text-xl font-bold quorum-text-primary tabular-nums">{kpi.value}</p>
              {kpi.badge && (
                <p className={`text-xs mt-1 ${kpi.good === true ? 'text-green-400' : 'quorum-text-subtle'}`}>
                  {kpi.badge}
                </p>
              )}
            </div>
          ))}
        </div>

        {/* Chart */}
        <div className="rounded-[24px] border quorum-border-default bg-[rgba(8,13,24,0.72)] p-4 md:p-5">
          <div className="flex items-center justify-between mb-4">
            <p className="text-sm font-medium quorum-text-primary">Visibilité vs Concurrents — 30 jours</p>
            <span className="text-xs quorum-text-subtle">Mise à jour il y a 2 h</span>
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
              <span className="text-xs quorum-text-muted">Votre marque</span>
            </div>
            <div className="flex items-center gap-2">
              <svg width="20" height="4" viewBox="0 0 20 4" aria-hidden="true">
                <line x1="0" y1="2" x2="20" y2="2" stroke="#6366F1" strokeWidth="1.5" strokeDasharray="5,3" />
              </svg>
              <span className="text-xs quorum-text-muted">Concurrent #1</span>
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
    <div className="rounded-xl bg-transparent p-5">
      <div className="flex items-center gap-2 mb-5">
        <BarChart3 className="w-4 h-4 text-blue-400" />
        <span className="text-sm font-medium quorum-text-primary">Topics actifs</span>
        <span className="ml-auto rounded-full bg-green-400/10 px-2.5 py-0.5 text-xs text-green-400">Live</span>
      </div>
      <div className="space-y-4">
        {topics.map((t, i) => (
          <div key={i}>
            <div className="flex items-center justify-between mb-1.5">
              <span className="text-xs quorum-text-muted">{t.label}</span>
              <div className="flex items-center gap-2">
                <span className={`text-xs font-medium ${t.up ? 'text-green-400' : 'text-red-400'}`}>{t.trend}</span>
                <span className="text-xs font-bold quorum-text-primary tabular-nums">{t.score} %</span>
              </div>
            </div>
            <div className="h-1.5 quorum-surface-strong rounded-full overflow-hidden">
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
    <div className="rounded-xl bg-transparent p-5">
      <div className="flex items-center gap-2 mb-5">
        <TrendingUp className="w-4 h-4 text-indigo-400" />
        <span className="text-sm font-medium quorum-text-primary">Competitive Snapshot</span>
        <span className="ml-auto text-xs quorum-text-subtle">Aujourd'hui</span>
      </div>
      <div className="space-y-3.5">
        {brands.map((b, i) => (
          <div key={i} className="flex items-center gap-3">
            <span className={`text-xs w-28 truncate flex-shrink-0 ${i === 0 ? 'quorum-text-primary font-medium' : 'quorum-text-muted'}`}>
              {b.name}
            </span>
            <div className="flex-1 h-7 quorum-surface rounded-lg overflow-hidden relative border quorum-border-default">
              <div
                className="h-full rounded-lg"
                style={{ width: `${b.score}%`, backgroundColor: `${b.color}22`, borderRight: `2px solid ${b.color}66` }}
              />
              <span className="absolute right-2.5 top-1/2 -translate-y-1/2 text-xs font-semibold quorum-text-primary tabular-nums">
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
    <div className="rounded-xl bg-transparent p-5">
      <div className="flex items-center gap-2 mb-5">
        <FileText className="w-4 h-4 text-green-400" />
        <span className="text-sm font-medium quorum-text-primary">Rapport Mensuel — Manutan</span>
        <span className="ml-auto text-xs quorum-text-subtle quorum-surface-strong px-2 py-0.5 rounded font-mono">PDF</span>
      </div>
      <div className="quorum-surface rounded-[22px] border quorum-border-default p-4 space-y-4">
        <div className="flex items-center justify-between">
          <span className="text-xs quorum-text-subtle">Score global</span>
          <span className="text-2xl font-bold quorum-text-primary tabular-nums">74 / 100</span>
        </div>
        <div className="h-px quorum-surface" />
        <div className="grid grid-cols-2 gap-3">
          {[
            { label: 'Visibilité', val: '77 %', good: true },
            { label: 'Part de citation', val: '34 %', good: true },
            { label: 'Concurrents battus', val: '3 / 5', good: null },
            { label: 'Prompts gagnants', val: '12', good: true },
          ].map((k, i) => (
            <div key={i} className="quorum-surface rounded-lg p-3 border quorum-border-default">
              <p className="text-xs quorum-text-subtle mb-1">{k.label}</p>
              <p className={`text-lg font-bold tabular-nums ${k.good ? 'text-green-400' : 'quorum-text-primary'}`}>{k.val}</p>
            </div>
          ))}
        </div>
        <button className="quorum-btn-secondary w-full rounded-xl py-2.5 text-xs">
          <FileText className="w-3.5 h-3.5" />
          Télécharger le PDF
        </button>
      </div>
    </div>
  );
}

function InsightsCard() {
  return (
    <div className="rounded-xl bg-transparent p-5">
      <div className="flex items-center gap-2 mb-5">
        <Zap className="w-4 h-4 text-yellow-400" />
        <span className="text-sm font-medium quorum-text-primary">Pourquoi vous gagnez / perdez</span>
      </div>
      <div className="space-y-3">
        <div className="p-4 rounded-xl bg-green-500/[0.05] border border-green-500/[0.15]">
          <div className="flex items-center gap-2 mb-2">
            <div className="w-2 h-2 rounded-full bg-green-400 flex-shrink-0" />
            <span className="text-xs font-semibold text-green-300 uppercase tracking-wide">Vous gagnez</span>
          </div>
          <p className="text-xs quorum-text-muted mb-1.5">&ldquo;meilleur fournisseur fournitures bureau B2B&rdquo;</p>
          <p className="text-xs text-green-400/70">Cité en 1re position dans 8 / 10 réponses</p>
        </div>
        <div className="p-4 rounded-xl bg-red-500/[0.05] border border-red-500/[0.15]">
          <div className="flex items-center gap-2 mb-2">
            <div className="w-2 h-2 rounded-full bg-red-400 flex-shrink-0" />
            <span className="text-xs font-semibold text-red-300 uppercase tracking-wide">Vous perdez</span>
          </div>
          <p className="text-xs quorum-text-muted mb-1.5">&ldquo;outillage professionnel pour PME&rdquo;</p>
          <p className="text-xs text-red-400/70">Concurrent A cité 3× plus souvent</p>
        </div>
        <div className="p-4 rounded-xl bg-blue-500/[0.05] border border-blue-500/[0.15]">
          <div className="flex items-center gap-2 mb-2">
            <Zap className="w-3.5 h-3.5 text-blue-400 flex-shrink-0" />
            <span className="text-xs font-semibold text-blue-300 uppercase tracking-wide">Action recommandée</span>
          </div>
          <p className="text-xs quorum-text-muted">
            Créer du contenu sur &ldquo;outillage PME&rdquo; — potentiel +18 % de score
          </p>
        </div>
      </div>
    </div>
  );
}

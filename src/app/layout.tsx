import type { Metadata } from 'next';
import Script from 'next/script';
import { Toaster } from 'sonner';
import { ThemeProvider } from '@/components/theme/theme-provider';
import { themeInitScript } from '@/components/theme/theme';
import './globals.css';

export const metadata: Metadata = {
  title: {
    default: 'Quorum - AI Visibility Analytics',
    template: '%s | Quorum',
  },
  description:
    'Mesurez et améliorez la visibilité de votre marque dans les réponses des IA (ChatGPT, Claude, Gemini, Perplexity).',
  keywords: ['GEO', 'AI visibility', 'ChatGPT', 'SEO', 'brand monitoring'],
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="fr" data-theme="dark" suppressHydrationWarning>
      <body className="min-h-screen">
        <Script id="quorum-theme-init" strategy="beforeInteractive">
          {themeInitScript}
        </Script>
        <ThemeProvider>
          {children}
          <Toaster
            position="top-right"
            toastOptions={{
              duration: 4000,
              style: {
                background: 'var(--quorum-shell-strong)',
                color: 'var(--quorum-text)',
                border: '1px solid var(--quorum-shell-border)',
                boxShadow: '0 20px 60px rgba(0,0,0,0.35)',
                backdropFilter: 'blur(18px)',
              },
            }}
          />
        </ThemeProvider>
      </body>
    </html>
  );
}

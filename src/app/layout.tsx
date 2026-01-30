import type { Metadata } from 'next';
import { Inter } from 'next/font/google';
import { Toaster } from 'sonner';
import './globals.css';

const inter = Inter({ subsets: ['latin'] });

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
    <html lang="fr">
      <body className={inter.className}>
        {children}
        <Toaster 
          position="top-right"
          toastOptions={{
            duration: 4000,
            style: {
              background: 'white',
              border: '1px solid #e5e7eb',
            },
          }}
        />
      </body>
    </html>
  );
}

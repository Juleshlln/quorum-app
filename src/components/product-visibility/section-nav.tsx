'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { cn } from '@/lib/utils';

const ITEMS = [
  { href: '/product-visibility', label: 'Vue d’ensemble' },
  { href: '/product-visibility/products', label: 'Produits suivis' },
  { href: '/product-visibility/categories', label: 'Catégories' },
  { href: '/product-visibility/prompts', label: 'Requêtes IA' },
  { href: '/product-visibility/results', label: 'Résultats' },
  { href: '/product-visibility/recommendations', label: 'Recommandations' },
];

export function ProductVisibilitySectionNav() {
  const pathname = usePathname();

  return (
    <div className="quorum-panel p-3">
      <div className="flex flex-wrap gap-2">
        {ITEMS.map((item) => {
          const active = pathname === item.href || pathname.startsWith(`${item.href}/`);

          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                'rounded-full border px-4 py-2 text-xs font-medium uppercase tracking-[0.15em] transition-all',
                active
                  ? 'quorum-border-strong quorum-surface-strong quorum-text-primary'
                  : 'border-[color:var(--quorum-border)] quorum-text-muted hover:quorum-text-primary hover:bg-[var(--quorum-surface)]',
              )}
            >
              {item.label}
            </Link>
          );
        })}
      </div>
    </div>
  );
}

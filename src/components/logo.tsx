import { Montserrat } from 'next/font/google';

const montserrat = Montserrat({
  subsets: ['latin'],
  weight: '900',
  display: 'swap',
});

export function QuorumLogo({ className = '' }: { className?: string }) {
  return (
    <span
      className={`tracking-[-0.04em] text-[#F5F0E8] ${montserrat.className} ${className}`}
    >
      QUORUM
    </span>
  );
}

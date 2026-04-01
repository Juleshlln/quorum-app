import Image from 'next/image';
import { cn } from '@/lib/utils';

const LOGO_WIDTH = 1179;
const LOGO_HEIGHT = 304;

export function QuorumLogo({
  className = '',
  adaptive = false,
  priority = false,
}: {
  className?: string;
  adaptive?: boolean;
  priority?: boolean;
}) {
  return (
    <span
      className={cn(
        'relative inline-flex h-8 w-auto max-w-full shrink-0',
        adaptive && 'quorum-logo--adaptive',
        className
      )}
      style={{ aspectRatio: `${LOGO_WIDTH} / ${LOGO_HEIGHT}` }}
    >
      <Image
        src="/quorum-logo.png"
        alt="Quorum"
        fill
        priority={priority}
        sizes="(max-width: 640px) 132px, (max-width: 1024px) 168px, 192px"
        className="object-contain object-left"
      />
    </span>
  );
}

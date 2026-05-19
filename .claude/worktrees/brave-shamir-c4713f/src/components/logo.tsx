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
        'inline-flex max-w-full shrink-0 overflow-visible',
        adaptive && 'quorum-logo--adaptive'
      )}
    >
      <Image
        src="/quorum-logo.png"
        alt="Quorum"
        width={LOGO_WIDTH}
        height={LOGO_HEIGHT}
        priority={priority}
        sizes="(max-width: 640px) 110px, (max-width: 1024px) 124px, 192px"
        className={cn(
          'block h-auto w-auto max-w-full shrink-0 object-contain object-left',
          className
        )}
      />
    </span>
  );
}

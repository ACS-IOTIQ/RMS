import Image from 'next/image';
import { cn } from '@/lib/utils';

// alt defaults to "" because the logo usually sits next to the "RosterOps" wordmark.
export function Logo({ size = 40, alt = '', className }: { size?: number; alt?: string; className?: string }) {
  return (
    <Image
      src="/logo.png"
      alt={alt}
      width={size}
      height={size}
      className={cn('shrink-0 select-none', className)}
      draggable={false}
    />
  );
}

'use client';

import * as React from 'react';
import { Avatar } from '@/components/ui/Avatar';
import { cn } from '@/lib/utils';

const sizeClass: Record<'lg' | 'xl', string> = {
  lg: 'h-14 w-14',
  xl: 'h-16 w-16',
};

/**
 * Provider avatar with a real photo (`avatarUrl`) and a graceful fallback to the
 * gradient-initials {@link Avatar} when the photo is missing or fails to load.
 * An availability dot (green pulse / grey) sits at the bottom-right. Client
 * component only because it needs the `<img onError>` fallback.
 */
export function ProviderAvatar({
  name,
  src,
  available = false,
  size = 'lg',
}: {
  name: string;
  src?: string | null;
  available?: boolean;
  size?: 'lg' | 'xl';
}) {
  const [errored, setErrored] = React.useState(false);
  const showImg = !!src && !errored;

  return (
    <div className="relative shrink-0">
      {showImg ? (
        // Provider photos come from our own upload bucket; a plain <img> with an
        // onError fallback avoids wiring arbitrary hosts into next/image.
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={src as string}
          alt={`Foto ${name}`}
          width={56}
          height={56}
          loading="lazy"
          onError={() => setErrored(true)}
          className={cn(
            'rounded-full object-cover shadow-soft ring-2',
            sizeClass[size],
            available ? 'ring-primary' : 'ring-white'
          )}
        />
      ) : (
        <Avatar name={name} size={size} className={available ? 'ring-primary' : undefined} />
      )}

      <span
        className="absolute -bottom-0.5 -right-0.5 flex h-4 w-4 items-center justify-center rounded-full bg-card"
        aria-hidden
      >
        <span className="relative flex h-2.5 w-2.5">
          {available && (
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-primary opacity-75" />
          )}
          <span
            className={cn(
              'relative inline-flex h-2.5 w-2.5 rounded-full',
              available ? 'bg-primary' : 'bg-muted-foreground/40'
            )}
          />
        </span>
      </span>
    </div>
  );
}

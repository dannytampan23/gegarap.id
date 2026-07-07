import Link from 'next/link';
import { MapPin, BadgeCheck, ArrowRight, Briefcase } from 'lucide-react';
import { Card } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { Rating } from '@/components/ui/Rating';
import { buttonVariants } from '@/components/ui/Button';
import { formatCurrency, cn } from '@/lib/utils';
import type { ProviderListItem } from '@/lib/types';
import { ProviderAvatar } from './ProviderAvatar';

export function ProviderCard({ provider }: { provider: ProviderListItem }) {
  const areaLabel =
    provider.districts.length > 0
      ? `${provider.districts[0]}${
          provider.districts.length > 1 ? ` +${provider.districts.length - 1}` : ''
        } · DIY`
      : 'DIY';

  return (
    <Card className="group flex h-full flex-col p-6 transition-all duration-300 hover:-translate-y-1 hover:border-primary/30 hover:shadow-elevated">
      <div className="flex items-start gap-4">
        <ProviderAvatar
          name={provider.user.name}
          src={provider.avatarUrl}
          available={provider.available}
          size="lg"
        />
        <div className="min-w-0 flex-1">
          <h3 className="truncate text-lg font-bold tracking-tight text-foreground">
            {provider.user.name}
          </h3>
          {provider.verificationBadges.length > 0 && (
            <div className="mt-1 flex flex-wrap gap-1.5">
              {provider.verificationBadges.map((badge) => (
                <span
                  key={badge.code}
                  className="inline-flex items-center gap-1 text-xs font-semibold text-primary"
                  title="Status verifikasi internal gegarap.id"
                >
                  <BadgeCheck className="h-3.5 w-3.5" />
                  {badge.label}
                </span>
              ))}
            </div>
          )}
          <div className="mt-1.5">
            <Badge variant="primary">{provider.category}</Badge>
          </div>
          <p className="mt-1.5 flex items-center gap-1 text-sm text-muted-foreground">
            <MapPin className="h-3.5 w-3.5 shrink-0" />
            <span className="truncate">{areaLabel}</span>
          </p>
        </div>
      </div>

      {provider.bio && (
        <p className="mt-4 line-clamp-2 text-sm leading-relaxed text-muted-foreground">
          {provider.bio}
        </p>
      )}

      <div className="mt-4 flex flex-wrap items-center gap-x-4 gap-y-2 text-sm">
        <Rating value={provider.rating} count={provider.ratingCount} />
        <span className="flex items-center gap-1 text-muted-foreground">
          <Briefcase className="h-3.5 w-3.5" />
          {provider.completedJobs}+ pekerjaan
        </span>
      </div>

      <p
        className={cn(
          'mt-3 inline-flex items-center gap-1.5 text-xs font-semibold',
          provider.available ? 'text-primary' : 'text-muted-foreground'
        )}
      >
        <span
          className={cn(
            'h-1.5 w-1.5 rounded-full',
            provider.available ? 'bg-primary' : 'bg-muted-foreground/50'
          )}
        />
        {provider.available ? 'Tersedia hari ini' : 'Jadwal penuh'}
      </p>

      <div className="mt-5 flex items-end justify-between border-t border-border pt-5">
        <div>
          <p className="text-xs text-muted-foreground">Estimasi mulai dari</p>
          <p className="text-xl font-extrabold tracking-tight text-foreground">
            {formatCurrency(provider.dailyRate)}
          </p>
        </div>
        <Link
          href={`/book/${provider.id}`}
          className={buttonVariants({ variant: 'primary', size: 'sm' })}
        >
          Booking Sekarang
          <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
        </Link>
      </div>
    </Card>
  );
}

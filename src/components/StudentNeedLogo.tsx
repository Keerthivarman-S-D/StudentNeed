import React from 'react';
import { cn } from '../lib/utils';

export interface StudentNeedLogoProps {
  /** Size variant or custom dimension */
  size?: 'xs' | 'sm' | 'md' | 'lg' | 'xl' | '2xl' | number;
  /** Only render the SN monogram without wordmark */
  iconOnly?: boolean;
  /** Custom class for outer wrapper */
  className?: string;
  /** Custom class for the monogram image */
  iconClassName?: string;
  /** Custom class for the wordmark text */
  textClassName?: string;
  /** Accessible alt text for icon */
  alt?: string;
}

const sizeMap = {
  xs: { icon: 'h-5 w-5', text: 'text-xs', gap: 'gap-1.5' },
  sm: { icon: 'h-6 w-6', text: 'text-sm', gap: 'gap-2' },
  md: { icon: 'h-8 w-8', text: 'text-xl', gap: 'gap-2.5' },
  lg: { icon: 'h-9 w-9', text: 'text-xl', gap: 'gap-2.5' },
  xl: { icon: 'h-10 w-10', text: 'text-2xl', gap: 'gap-3' },
  '2xl': { icon: 'h-12 w-12', text: 'text-3xl', gap: 'gap-3' },
};

/**
 * StudentNeed Monogram Icon
 * Visual source of truth: 100% faithful to provided SN monogram geometry
 */
export function StudentNeedIcon({
  size = 'md',
  className,
  alt = 'StudentNeed Monogram',
}: {
  size?: 'xs' | 'sm' | 'md' | 'lg' | 'xl' | '2xl' | number;
  className?: string;
  alt?: string;
}) {
  const isCustomNumber = typeof size === 'number';
  const resolvedClass = isCustomNumber ? '' : sizeMap[size]?.icon || sizeMap.md.icon;

  return (
    <img
      src="/studentneed-monogram.png"
      alt={alt}
      width={isCustomNumber ? size : undefined}
      height={isCustomNumber ? size : undefined}
      style={isCustomNumber ? { width: size, height: size } : undefined}
      className={cn('object-contain select-none shrink-0 transition-transform', resolvedClass, className)}
      loading="eager"
      decoding="async"
    />
  );
}

/**
 * StudentNeed Logo with SN Monogram + Dual-tone Wordmark
 * "Student" in dark charcoal/black + "Need" in teal
 */
export function StudentNeedLogo({
  size = 'md',
  iconOnly = false,
  className,
  iconClassName,
  textClassName,
  alt = 'StudentNeed',
}: StudentNeedLogoProps) {
  const isCustomNumber = typeof size === 'number';
  const sizeConfig = isCustomNumber ? null : (sizeMap[size] || sizeMap.md);

  const iconElement = (
    <StudentNeedIcon
      size={size}
      className={iconClassName}
      alt={alt}
    />
  );

  if (iconOnly) {
    return iconElement;
  }

  return (
    <div className={cn('inline-flex items-center select-none', sizeConfig ? sizeConfig.gap : 'gap-2.5', className)}>
      {iconElement}
      <span
        className={cn(
          'font-bold tracking-tight text-zinc-900 leading-none flex items-center',
          sizeConfig?.text || 'text-xl',
          textClassName
        )}
      >
        <span>Student</span>
        <span className="text-[#0b7355]">Need</span>
      </span>
    </div>
  );
}

export default StudentNeedLogo;

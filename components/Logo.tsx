import Image from 'next/image';

interface LogoProps {
  size?: 'sm' | 'md' | 'lg';
  showWordmark?: boolean;
  className?: string;
}

const sizeMap = {
  sm: { mark: 'h-7 w-7', wordmark: 'h-8 w-auto max-w-[150px]' },
  md: { mark: 'h-9 w-9', wordmark: 'h-10 w-auto max-w-[190px]' },
  lg: { mark: 'h-12 w-12', wordmark: 'h-14 w-auto max-w-[260px]' },
};

export function Logo({ size = 'md', showWordmark = true, className = '' }: LogoProps) {
  const s = sizeMap[size];
  const asset = showWordmark
    ? {
        src: '/brand/bookanord-logo.png',
        width: 1680,
        height: 360,
        className: s.wordmark,
      }
    : {
        src: '/brand/bookanord-mark.png',
        width: 925,
        height: 883,
        className: `${s.mark} object-contain`,
      };

  return (
    <div className={`flex items-center ${className}`}>
      <Image
        src={asset.src}
        alt="BookaNord"
        width={asset.width}
        height={asset.height}
        className={`${asset.className} dark:brightness-0 dark:invert`}
        priority={size === 'lg'}
        unoptimized
      />
    </div>
  );
}

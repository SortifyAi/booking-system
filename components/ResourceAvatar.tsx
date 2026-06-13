'use client'

interface ResourceAvatarProps {
  name: string
  imageUrl?: string | null
  className?: string
  imageClassName?: string
}

function getInitials(name: string) {
  return name
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join('') || 'M'
}

export function ResourceAvatar({
  name,
  imageUrl,
  className = 'h-12 w-12',
  imageClassName = 'rounded-xl',
}: ResourceAvatarProps) {
  const baseClassName = `${className} ${imageClassName} flex-shrink-0 overflow-hidden bg-gradient-to-br from-blue-50 to-cyan-100 ring-1 ring-blue-100 dark:from-slate-700 dark:to-slate-800 dark:ring-slate-600`

  if (imageUrl) {
    return (
      <div className={baseClassName}>
        <img
          src={imageUrl}
          alt={`Foto von ${name}`}
          className="h-full w-full object-cover"
          loading="lazy"
        />
      </div>
    )
  }

  return (
    <div className={`${baseClassName} flex items-center justify-center`}>
      <span className="text-sm font-semibold text-blue-700 dark:text-blue-100">
        {getInitials(name)}
      </span>
    </div>
  )
}

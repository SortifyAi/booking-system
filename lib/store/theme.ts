// @ts-nocheck
'use client'

export type Theme = 'light' | 'dark' | 'system'
export type EffectiveTheme = 'light' | 'dark'

export interface ThemeContextType {
  theme: Theme
  setTheme: (theme: Theme) => void
  effectiveTheme: EffectiveTheme
}

export const THEME_STORAGE_KEY = 'booking-system-theme'
export const THEME_OVERRIDE_DATASET_KEY = 'bookingThemeOverride'

export function getThemeFromStorage(): Theme {
  if (typeof window === 'undefined') return 'system'
  const stored = localStorage.getItem(THEME_STORAGE_KEY)
  return (stored as Theme) || 'system'
}

export function saveThemeToStorage(theme: Theme): void {
  if (typeof window === 'undefined') return
  localStorage.setItem(THEME_STORAGE_KEY, theme)
}

export function getEffectiveTheme(theme: Theme): EffectiveTheme {
  if (theme === 'system') {
    if (typeof window === 'undefined') return 'light'
    return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'
  }
  return theme
}

function getDocumentThemeOverride(): EffectiveTheme | null {
  if (typeof document === 'undefined') return null
  const value = document.documentElement.dataset[THEME_OVERRIDE_DATASET_KEY]
  return value === 'light' || value === 'dark' ? value : null
}

export function setDocumentThemeOverride(theme: EffectiveTheme | null): void {
  if (typeof document === 'undefined') return
  const html = document.documentElement

  if (theme) {
    html.dataset[THEME_OVERRIDE_DATASET_KEY] = theme
  } else {
    delete html.dataset[THEME_OVERRIDE_DATASET_KEY]
  }

  applyTheme(theme ?? getEffectiveTheme(getThemeFromStorage()))
}

export function applyTheme(theme: EffectiveTheme): void {
  if (typeof document === 'undefined') return
  const html = document.documentElement
  const effectiveTheme = getDocumentThemeOverride() ?? theme

  if (effectiveTheme === 'dark') {
    html.classList.add('dark')
    html.style.colorScheme = 'dark'
  } else {
    html.classList.remove('dark')
    html.style.colorScheme = 'light'
  }
}

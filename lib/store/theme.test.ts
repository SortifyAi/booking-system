import assert from 'node:assert/strict'

const classes = new Set<string>()
const dataset: Record<string, string> = {}
const style = { colorScheme: '' }

;(globalThis as any).document = {
  documentElement: {
    dataset,
    style,
    classList: {
      add: (value: string) => classes.add(value),
      remove: (value: string) => classes.delete(value),
      contains: (value: string) => classes.has(value),
    },
  },
}
;(globalThis as any).localStorage = {
  getItem: () => 'light',
  setItem: () => undefined,
}
;(globalThis as any).window = {
  matchMedia: () => ({ matches: false }),
}

const theme: any = await import('./theme.ts')

theme.setDocumentThemeOverride('dark')
assert.equal(dataset.bookingThemeOverride, 'dark')
assert.equal(classes.has('dark'), true)
assert.equal(style.colorScheme, 'dark')

theme.applyTheme('light')
assert.equal(
  classes.has('dark'),
  true,
  'normal theme changes must not override the public booking page'
)

theme.setDocumentThemeOverride(null)
assert.equal(dataset.bookingThemeOverride, undefined)
assert.equal(classes.has('dark'), false)
assert.equal(style.colorScheme, 'light')

delete (globalThis as any).document
delete (globalThis as any).localStorage
delete (globalThis as any).window

console.log('theme.test.ts: all assertions passed')

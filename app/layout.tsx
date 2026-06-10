import type { Metadata } from 'next'
import '@/styles/globals.css'
import { Providers } from '@/components/Providers'

export const metadata: Metadata = {
  title: 'BookaNord',
  description: 'BookaNord – das moderne Buchungssystem für Teams im Norden.',
  icons: {
    icon: '/brand/bookanord-mark.png',
    shortcut: '/brand/bookanord-mark.png',
    apple: '/brand/bookanord-mark.png',
  },
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="de">
      <body>
        <Providers>{children}</Providers>
      </body>
    </html>
  )
}

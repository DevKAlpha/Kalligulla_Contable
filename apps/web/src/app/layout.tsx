import type { Metadata, Viewport } from 'next'
import { DM_Mono, Space_Grotesk } from 'next/font/google'
import type { ReactNode } from 'react'
import { BOOT_INIT_SCRIPT, THEME_INIT_SCRIPT } from '@/features/theme/init-scripts'
import { Providers } from './providers'
import './globals.css'

const spaceGrotesk = Space_Grotesk({ subsets: ['latin'], variable: '--font-space-grotesk', display: 'swap' })
const dmMono = DM_Mono({ subsets: ['latin'], weight: ['400', '500'], variable: '--font-dm-mono', display: 'swap' })

export const metadata: Metadata = {
  title: { default: 'Kaligula — Consola financiera', template: '%s · Kaligula' },
  description: 'Kaligula, consola financiera personal para controlar ingresos, gastos, inversiones y préstamos.',
  applicationName: 'Kaligula',
  manifest: '/manifest.webmanifest',
  icons: { icon: '/icon-192.png', apple: '/icon-192.png' },
}

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  viewportFit: 'cover',
  themeColor: [
    { media: '(prefers-color-scheme: light)', color: '#e6e2d6' },
    { media: '(prefers-color-scheme: dark)', color: '#0c0d11' },
  ],
}

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="es-CO" suppressHydrationWarning className={`${spaceGrotesk.variable} ${dmMono.variable}`}>
      <head>
        <script dangerouslySetInnerHTML={{ __html: `${THEME_INIT_SCRIPT};${BOOT_INIT_SCRIPT}` }} />
      </head>
      <body>
        <a href="#contenido" className="sr-only z-50 rounded-lg bg-accent px-3 py-2 font-semibold text-on-accent focus:not-sr-only focus:fixed focus:top-3 focus:left-3">
          Saltar al contenido
        </a>
        <Providers>{children}</Providers>
      </body>
    </html>
  )
}

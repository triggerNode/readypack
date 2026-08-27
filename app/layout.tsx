import type { Metadata } from 'next'
import { Manrope, JetBrains_Mono } from 'next/font/google'
import { Analytics } from '@vercel/analytics/next'
import './globals.css'

const manrope = Manrope({
  subsets: ['latin'],
  weight: ['300', '400', '500', '600', '700', '800'],
  variable: '--font-manrope',
  display: 'swap',
})

const jetbrainsMono = JetBrains_Mono({
  subsets: ['latin'],
  weight: ['400', '500', '600'],
  variable: '--font-mono',
  display: 'swap',
})

export const metadata: Metadata = {
  title: {
    default: 'ReadyPack | AI Compliance Documentation',
    template: '%s · ReadyPack',
  },
  // Site-wide fallback description: it is what Google and LinkedIn show for any
  // page without its own. The EU AI Act was removed on 2026-08-27 because
  // whether it applies to a UK-only business is not established, and this line
  // was asserting it to every visitor by default.
  description:
    'Nine AI governance documents for UK businesses under 50 staff. Written for one specific business, covering UK GDPR and the DUAA. Delivered in 48 hours.',
  metadataBase: new URL(process.env.NEXT_PUBLIC_APP_URL ?? 'https://readypack.co.uk'),
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html
      lang="en"
      data-theme="dark"
      className={`${manrope.variable} ${jetbrainsMono.variable}`}
    >
      <body>
        {children}
        <Analytics />
      </body>
    </html>
  )
}

import type { Metadata } from 'next'
import { Manrope, JetBrains_Mono } from 'next/font/google'
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
    default: 'ReadyPack — AI Compliance Documentation',
    template: '%s · ReadyPack',
  },
  description:
    'Nine compliance documents covering UK GDPR, EU AI Act, and DUAA. Delivered in 48 hours.',
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
      <body>{children}</body>
    </html>
  )
}

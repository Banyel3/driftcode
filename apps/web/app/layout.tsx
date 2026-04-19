import type { Metadata } from 'next'
import { Geist, Geist_Mono } from 'next/font/google'
import './globals.css'

const geistSans = Geist({
  variable: '--font-geist-sans',
  subsets: ['latin'],
})

const geistMono = Geist_Mono({
  variable: '--font-geist-mono',
  subsets: ['latin'],
})

export const metadata: Metadata = {
  metadataBase: new URL('https://driftcode.dev'),
  title: 'DriftCode — AI coding from your phone',
  description:
    'A self-hostable mobile client for opencode. Connect your server, browse GitHub repos, and run agentic coding sessions from anywhere.',
  openGraph: {
    title: 'DriftCode',
    description: 'AI coding sessions from your phone.',
    url: 'https://driftcode.dev',
    siteName: 'DriftCode',
    images: [{ url: '/og.png', width: 1200, height: 630 }],
    locale: 'en_US',
    type: 'website',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'DriftCode — AI coding from your phone',
    description: 'A self-hostable mobile client for opencode.',
    images: ['/og.png'],
  },
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en" className={`${geistSans.variable} ${geistMono.variable}`}>
      <body className="font-sans">{children}</body>
    </html>
  )
}

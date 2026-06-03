import type { Metadata } from 'next'
import './globals.css'
import Navbar from '@/components/Navbar'
import Sidebar from '@/components/Sidebar'

export const metadata: Metadata = {
  title: 'OpenTube - 오픈튜브',
  description: '오프라인에서도 동작하는 YouTube 클론',
  manifest: '/manifest.json',
  icons: { icon: '/favicon.svg', shortcut: '/favicon.svg' },
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="ko">
      <head>
        <meta name="theme-color" content="#ff0000" />
        <link rel="manifest" href="/manifest.json" />
      </head>
      <body className="bg-[#0f0f0f] text-white antialiased">
        <Navbar />
        <div className="flex h-screen pt-14">
          <div className="hidden lg:block">
            <Sidebar />
          </div>
          <main className="flex-1 overflow-y-auto">
            {children}
          </main>
        </div>
      </body>
    </html>
  )
}

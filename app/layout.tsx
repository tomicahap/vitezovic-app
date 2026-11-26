import type { Metadata, Viewport } from 'next'
import { Geist, Geist_Mono } from 'next/font/google'
import { Libre_Baskerville } from 'next/font/google'
import { Analytics } from '@vercel/analytics/next'
import { MembersProvider } from '@/contexts/members-context'
import { MeetingsProvider } from '@/contexts/meetings-context'
import { LecturesProvider } from '@/contexts/lectures-context'
import { LibraryProvider } from '@/contexts/library-context'
import { ProjectsProvider } from '@/contexts/projects-context'
import { ContactsProvider } from '@/contexts/contacts-context'
import { LinksProvider } from '@/contexts/links-context'
import { AuthProvider } from '@/contexts/auth-context'
import { ActivityLogProvider } from '@/contexts/activity-log-context'
import { SettingsProvider } from '@/contexts/settings-context'
import { VotingOverlay } from '@/components/voting-overlay'
import { AuthGate } from '@/components/auth-gate'
import { GlobalConfirmDialog } from '@/components/ui/confirm-dialog'
import { Toaster } from 'sonner'
import './globals.css'

const _geist = Geist({ subsets: ["latin"], variable: "--font-sans" });
const _geistMono = Geist_Mono({ subsets: ["latin"], variable: "--font-mono" });
const libreBaskerville = Libre_Baskerville({ 
  weight: ['400', '700'],
  subsets: ["latin"], 
  variable: "--font-serif" 
});

export const metadata: Metadata = {
  title: 'Rodoslovac — Rodoslovno društvo Pavao Ritter Vitezović',
  description: 'Sustav Rodoslovac — administrativni portal Hrvatskog rodoslovnog društva Pavao Ritter Vitezović',
  applicationName: 'Rodoslovac',
  appleWebApp: {
    capable: true,
    title: 'Rodoslovac',
    statusBarStyle: 'default',
  },
  icons: {
    icon: [
      {
        url: '/favicon.ico?v=20261120',
        sizes: 'any',
      },
      {
        url: '/icon-16x16.png?v=20261120',
        sizes: '16x16',
        type: 'image/png',
      },
      {
        url: '/icon-32x32.png?v=20261120',
        sizes: '32x32',
        type: 'image/png',
      },
      {
        url: '/icon-192x192.png?v=20261120',
        sizes: '192x192',
        type: 'image/png',
      },
      {
        url: '/icon.svg?v=20261120',
        type: 'image/svg+xml',
      },
    ],
    shortcut: '/favicon.ico?v=20261120',
    apple: [
      {
        url: '/apple-icon.png?v=20261120',
        sizes: '180x180',
        type: 'image/png',
      },
    ],
  },
}

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  viewportFit: 'cover',
  themeColor: '#F2EFE9',
}

// Primijeni spremljenu postavku povećanog prikaza prije prvog iscrtavanja
const zoomInitScript = `try{if(localStorage.getItem('zoom-a11y')==='1'){document.documentElement.classList.add('zoom-a11y')}}catch(e){}`

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="hr" suppressHydrationWarning className={`${_geist.variable} ${_geistMono.variable} ${libreBaskerville.variable}`}>
      <head>
        <script dangerouslySetInnerHTML={{ __html: zoomInitScript }} />
      </head>
      <body className="font-sans antialiased bg-background" suppressHydrationWarning>
        <ActivityLogProvider>
          <AuthProvider>
            <SettingsProvider>
              <MembersProvider>
                <MeetingsProvider>
                  <LecturesProvider>
                    <LibraryProvider>
                      <ProjectsProvider>
                        <ContactsProvider>
                          <LinksProvider>
                            <AuthGate>
                              {children}
                              <VotingOverlay />
                            </AuthGate>
                          </LinksProvider>
                        </ContactsProvider>
                      </ProjectsProvider>
                    </LibraryProvider>
                  </LecturesProvider>
                </MeetingsProvider>
              </MembersProvider>
            </SettingsProvider>
          </AuthProvider>
        </ActivityLogProvider>
        <GlobalConfirmDialog />
        <Toaster position="bottom-right" richColors closeButton />
        {process.env.NODE_ENV === 'production' && process.env.VERCEL && <Analytics />}
      </body>
    </html>
  )
}

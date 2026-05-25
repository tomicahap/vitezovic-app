import type { Metadata } from 'next'
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
import './globals.css'

const _geist = Geist({ subsets: ["latin"], variable: "--font-sans" });
const _geistMono = Geist_Mono({ subsets: ["latin"], variable: "--font-mono" });
const libreBaskerville = Libre_Baskerville({ 
  weight: ['400', '700'],
  subsets: ["latin"], 
  variable: "--font-serif" 
});

export const metadata: Metadata = {
  title: 'Rodoslov - Administracija društva',
  description: 'Administrativni portal rodoslovnog društva Pavao Ritter Vitezović',
  generator: 'v0.app',
  icons: {
    icon: [
      {
        url: '/icon-light-32x32.png',
        media: '(prefers-color-scheme: light)',
      },
      {
        url: '/icon-dark-32x32.png',
        media: '(prefers-color-scheme: dark)',
      },
      {
        url: '/icon.svg',
        type: 'image/svg+xml',
      },
    ],
    apple: '/apple-icon.png',
  },
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="hr" suppressHydrationWarning className={`${_geist.variable} ${_geistMono.variable} ${libreBaskerville.variable}`}>
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
        {process.env.NODE_ENV === 'production' && process.env.VERCEL && <Analytics />}
      </body>
    </html>
  )
}

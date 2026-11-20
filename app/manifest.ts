import type { MetadataRoute } from 'next'

// Web App Manifest – omogućuje "Dodaj na početni zaslon" na mobitelu,
// nakon čega se aplikacija otvara preko cijelog ekrana kao nativna aplikacija.
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'Rodoslovac — HRD Pavao Ritter Vitezović',
    short_name: 'Rodoslovac',
    description: 'Administrativni portal Hrvatskog rodoslovnog društva „Pavao Ritter Vitezović”',
    start_url: '/',
    display: 'standalone',
    background_color: '#F2EFE9',
    theme_color: '#1B2B36',
    lang: 'hr',
    icons: [
      { src: '/icon-192x192.png', sizes: '192x192', type: 'image/png' },
      { src: '/icon-512x512.png', sizes: '512x512', type: 'image/png' },
      { src: '/apple-icon.png', sizes: '180x180', type: 'image/png' },
      { src: '/icon.svg', sizes: 'any', type: 'image/svg+xml' },
    ],
  }
}

import type { MetadataRoute } from 'next'

// Web App Manifest – omogućuje "Dodaj na početni zaslon" na mobitelu,
// nakon čega se aplikacija otvara preko cijelog ekrana kao nativna aplikacija.
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'HRD Pavao Ritter Vitezović',
    short_name: 'HRD Vitezović',
    description: 'Administrativni portal rodoslovnog društva',
    start_url: '/',
    display: 'standalone',
    background_color: '#F2EFE9',
    theme_color: '#F2EFE9',
    lang: 'hr',
    icons: [
      { src: '/apple-icon.png', sizes: '180x180', type: 'image/png' },
      { src: '/icon.svg', sizes: 'any', type: 'image/svg+xml' },
    ],
  }
}

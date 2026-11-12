/** @type {import('next').NextConfig} */
const nextConfig = {
  serverExternalPackages: ['better-sqlite3'],
  outputFileTracingExcludes: {
    '*': [
      './next.config.mjs',
      'next.config.mjs'
    ],
  },
  typescript: {
    ignoreBuildErrors: true,
  },
  images: {
    unoptimized: true,
  },
  async rewrites() {
    return [
      {
        source: '/uploads/:filename*',
        destination: '/api/uploads/:filename*',
      },
    ]
  },
}

export default nextConfig

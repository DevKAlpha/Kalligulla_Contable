import path from 'node:path'
import type { NextConfig } from 'next'

const config: NextConfig = {
  // Self-contained server for Docker and the Electron desktop build.
  output: 'standalone',
  outputFileTracingRoot: path.resolve(process.cwd(), '../..'),
  transpilePackages: ['@kaligula/domain', '@kaligula/contracts', '@kaligula/api', '@kaligula/db'],
  // Database drivers stay as regular Node modules (PGlite loads its WebAssembly files at runtime).
  serverExternalPackages: ['@electric-sql/pglite', 'pg'],
  poweredByHeader: false,
  reactStrictMode: true,
  // No floating Next.js badge over the console in development; build and runtime errors still show.
  devIndicators: false,
  async headers() {
    return [
      {
        source: '/:path*',
        headers: [
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
          { key: 'X-Frame-Options', value: 'SAMEORIGIN' },
          { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=()' },
        ],
      },
      { source: '/sw.js', headers: [{ key: 'Cache-Control', value: 'no-cache' }] },
    ]
  },
}

export default config

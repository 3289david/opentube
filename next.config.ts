import type { NextConfig } from 'next'

const nextConfig: NextConfig = {
  basePath: '/yt',
  output: 'standalone',
  images: {
    remotePatterns: [
      { protocol: 'https', hostname: 'i.ytimg.com' },
      { protocol: 'https', hostname: 'yt3.ggpht.com' },
      { protocol: 'https', hostname: 'yt3.googleusercontent.com' },
    ],
  },
}

export default nextConfig

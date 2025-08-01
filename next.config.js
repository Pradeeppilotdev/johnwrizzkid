/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  images: {
    domains: ['localhost'],
    unoptimized: true, // Disable image optimization for static export compatibility
  },
  // Ensure static files are properly served
  assetPrefix: '',
  trailingSlash: false,
  // Add headers for static assets
  async headers() {
    return [
      {
        source: '/johngettingpunched/:path*',
        headers: [
          {
            key: 'Cache-Control',
            value: 'public, max-age=31536000, immutable',
          },
        ],
      },
    ];
  },
}

module.exports = nextConfig
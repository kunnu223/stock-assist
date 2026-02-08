/** @type {import('next').NextConfig} */
const nextConfig = {
  transpilePackages: ['@stock-assist/shared'],
  
  // Increase timeout for API proxy (2 minutes)
  experimental: {
    proxyTimeout: 120000,
  },
  
  async rewrites() {
    return [
      {
        source: '/api/:path*',
        destination: 'http://localhost:4000/api/:path*',
      },
    ];
  },
};

module.exports = nextConfig;


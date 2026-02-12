/** @type {import('next').NextConfig} */
const nextConfig = {
  transpilePackages: ['@stock-assist/shared'],
  
  // Increase timeout for API proxy (2 minutes)
  experimental: {
    proxyTimeout: 120000,
  },
  
  async rewrites() {
const API_URL = process.env.API_URL || 'http://localhost:4000';

    return [
      {
        source: '/api/:path*',
        destination: `${API_URL}/api/:path*`,
      },
    ];
  },
};

module.exports = nextConfig;


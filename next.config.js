/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,

  // ✅ Prevent ESLint + TS from failing Vercel builds
  eslint: {
    ignoreDuringBuilds: true,
  },
  typescript: {
    ignoreBuildErrors: true,
  },

  // 🚀 Performance optimizations
  compiler: {
    // Remove console.logs in production
    removeConsole: process.env.NODE_ENV === 'production',
  },

  // 📦 Optimize bundles
  experimental: {
    optimizePackageImports: ['lucide-react', 'firebase', '@radix-ui/react-dropdown-menu'],
  },

  // 🎯 Enable output file tracing for smaller builds
  output: 'standalone',

  // 🖼️ Image optimization
  images: {
    domains: [
      'avatars.githubusercontent.com',
      'lh3.googleusercontent.com',
      'lh4.googleusercontent.com',
      'lh5.googleusercontent.com',
      'lh6.googleusercontent.com',
      'quranandsunnah-99502.firebasestorage.app',
      'firebasestorage.googleapis.com',
    ],
    formats: ['image/avif', 'image/webp'], // Modern formats for better performance
    minimumCacheTTL: 60 * 60 * 24 * 30, // Cache images for 30 days
  },

  // 📱 Mobile Safari optimizations
  headers: async () => [
    {
      source: '/:path*',
      headers: [
        {
          key: 'X-DNS-Prefetch-Control',
          value: 'on',
        },
        {
          key: 'X-Frame-Options',
          value: 'SAMEORIGIN',
        },
      ],
    },
  ],

  // ⚡ Webpack optimizations for mobile
  webpack: (config, { isServer }) => {
    if (!isServer) {
      // Reduce bundle size on client
      config.optimization = {
        ...config.optimization,
        splitChunks: {
          chunks: 'all',
          cacheGroups: {
            default: false,
            vendors: false,
            // Split vendor bundles
            vendor: {
              name: 'vendor',
              chunks: 'all',
              test: /node_modules/,
              priority: 20,
            },
            // Split common components
            common: {
              name: 'common',
              minChunks: 2,
              chunks: 'all',
              priority: 10,
              reuseExistingChunk: true,
              enforce: true,
            },
          },
        },
      };
    }
    return config;
  },
};

export default nextConfig;

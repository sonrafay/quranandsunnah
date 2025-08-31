/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  images: {
    domains: [
      // existing
      'avatars.githubusercontent.com',
      // Google user avatars (any of these may be used)
      'lh3.googleusercontent.com',
      'lh4.googleusercontent.com',
      'lh5.googleusercontent.com',
      'lh6.googleusercontent.com',
      // Firebase Storage (your project)
      'quranandsunnah-99502.firebasestorage.app',
      // (optional) add if you ever serve from the legacy domain:
      'firebasestorage.googleapis.com',
    ],
  },
};

export default nextConfig;

/**
 * @type {import('next').NextConfig}
 */
const nextConfig = {
  experimental: {
    serverComponentsExternalPackages: ['fluent-ffmpeg'],
  },
  reactStrictMode: true,
  env: {
    // Make sure these are set in your .env.local file
    NEXT_PUBLIC_GOOGLE_CLIENT_ID: process.env.GOOGLE_CLIENT_ID,
  },
  // Set the default port for the development server
  devServer: {
    port: 3000,
  },
}

module.exports = nextConfig
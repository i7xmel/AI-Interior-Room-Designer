/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  transpilePackages: ["three"],
  experimental: {
    serverActions: { bodySizeLimit: "100mb" },
  },
  webpack: (config) => {
    config.externals = config.externals || [];
    return config;
  },
};
module.exports = nextConfig;

import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  async rewrites() {
    return [
      {
        source: '/auth/register',
        destination: '/register',
      },
      {
        source: '/auth/login',
        destination: '/login',
      },
    ];
  },
};

export default nextConfig;

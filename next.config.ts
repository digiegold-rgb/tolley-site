import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  async redirects() {
    return [
      {
        source: "/trailers/:path*",
        destination: "/trailer/:path*",
        permanent: true,
      },
      {
        source: "/trailers",
        destination: "/trailer",
        permanent: true,
      },
    ];
  },
};

export default nextConfig;

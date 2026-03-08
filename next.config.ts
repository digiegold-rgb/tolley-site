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
      {
        source: "/generators/:path*",
        destination: "/generator/:path*",
        permanent: true,
      },
      {
        source: "/generators",
        destination: "/generator",
        permanent: true,
      },
      {
        source: "/moving-supplies",
        destination: "/moving",
        permanent: true,
      },
    ];
  },
};

export default nextConfig;

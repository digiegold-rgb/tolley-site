import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "*.public.blob.vercel-storage.com",
      },
    ],
  },
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
      {
        source: "/home",
        destination: "/homes",
        permanent: true,
      },
      {
        source: "/heating",
        destination: "/hvac",
        permanent: true,
      },
      {
        source: "/cooling",
        destination: "/hvac",
        permanent: true,
      },
      {
        source: "/ac",
        destination: "/hvac",
        permanent: true,
      },
      {
        source: "/dispatch",
        destination: "/lastmile",
        permanent: true,
      },
      {
        source: "/delivery",
        destination: "/lastmile",
        permanent: true,
      },
      {
        source: "/store",
        destination: "/shop",
        permanent: true,
      },
      {
        source: "/vater/course/:path*",
        destination: "/vater/courses/:path*",
        permanent: true,
      },
      {
        source: "/pool",
        destination: "/pools",
        permanent: true,
      },
      {
        source: "/crypto",
        destination: "/trading/crypto",
        permanent: true,
      },
    ];
  },
};

export default nextConfig;

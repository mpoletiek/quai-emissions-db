/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,

  // Legacy routes superseded by /dashboard/*. Permanent redirects (308)
  // preserve query strings so old bookmarks like
  // /history?period=day&range=30d still land on the right view.
  async redirects() {
    return [
      { source: "/history", destination: "/dashboard/history", permanent: true },
    ];
  },
};

export default nextConfig;

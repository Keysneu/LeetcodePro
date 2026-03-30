/** @type {import('next').NextConfig} */
const isDev = process.env.NODE_ENV !== "production";

const nextConfig = {
  reactStrictMode: true,
  // Avoid cache/chunk conflicts when `next dev` and `next build` run at different times.
  distDir: isDev ? ".next-dev" : ".next"
};

export default nextConfig;

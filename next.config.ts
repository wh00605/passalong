import type { NextConfig } from "next";

const supabaseHost = process.env.NEXT_PUBLIC_SUPABASE_URL ? new URL(process.env.NEXT_PUBLIC_SUPABASE_URL).host : null;

const csp = [
  "default-src 'self'",
  // Next.js injects inline bootstrapping scripts; Stripe.js must load from js.stripe.com.
  `script-src 'self' 'unsafe-inline'${process.env.NODE_ENV === "production" ? "" : " 'unsafe-eval'"} https://js.stripe.com`,
  "style-src 'self' 'unsafe-inline'",
  `img-src 'self' data: blob: https://*.stripe.com${supabaseHost ? ` https://${supabaseHost}` : ""}`,
  "font-src 'self'",
  `connect-src 'self' https://api.stripe.com${supabaseHost ? ` https://${supabaseHost} wss://${supabaseHost}` : ""}`,
  "frame-src https://js.stripe.com https://hooks.stripe.com https://connect-js.stripe.com",
  "frame-ancestors 'none'",
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'self' https://appleid.apple.com https://accounts.google.com https://connect.stripe.com",
  "worker-src 'self'",
  "manifest-src 'self'",
  ...(process.env.NODE_ENV === "production" && process.env.NEXT_PUBLIC_SITE_URL?.startsWith("https://")
    ? ["upgrade-insecure-requests"]
    : []),
].join("; ");

const nextConfig: NextConfig = {
  poweredByHeader: false,
  experimental: {
    authInterrupts: true,
    serverActions: { bodySizeLimit: "12mb" },
  },
  serverExternalPackages: ["sharp"],
  images: {
    formats: ["image/avif", "image/webp"],
    qualities: [60, 75],
    remotePatterns: supabaseHost ? [{ protocol: "https", hostname: supabaseHost, pathname: "/storage/v1/object/public/**" }] : [],
  },
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          { key: "Content-Security-Policy", value: csp },
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=(), payment=(self \"https://js.stripe.com\")" },
          { key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains; preload" },
          { key: "X-Frame-Options", value: "DENY" },
        ],
      },
    ];
  },
};

export default nextConfig;

// Central place to read configuration. Integrations report whether they are configured
// so the UI can show an honest "not set up yet" state instead of pretending to work.

// On Vercel, fall back to the project's production domain so a first deploy works before
// NEXT_PUBLIC_SITE_URL is set.
const vercelHost =
  process.env.NEXT_PUBLIC_VERCEL_PROJECT_PRODUCTION_URL ?? process.env.VERCEL_PROJECT_PRODUCTION_URL;

export const siteUrl = (
  process.env.NEXT_PUBLIC_SITE_URL || (vercelHost ? `https://${vercelHost}` : "http://localhost:3000")
).replace(/\/$/, "");

export const isProduction = process.env.NODE_ENV === "production";

export const integrations = {
  google: () => Boolean(process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET),
  apple: () => Boolean(process.env.APPLE_CLIENT_ID && process.env.APPLE_CLIENT_SECRET),
  stripe: () => Boolean(process.env.STRIPE_SECRET_KEY),
  supabaseStorage: () =>
    Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY) &&
    process.env.LOCAL_UPLOADS !== "true",
  supabaseRealtime: () => Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY),
  resend: () => Boolean(process.env.RESEND_API_KEY),
  shippo: () => Boolean(process.env.SHIPPO_API_KEY),
  webPush: () => Boolean(process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY && process.env.VAPID_PRIVATE_KEY),
  upstash: () => Boolean(process.env.UPSTASH_REDIS_REST_URL && process.env.UPSTASH_REDIS_REST_TOKEN),
};

export function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`Missing required environment variable ${name}`);
  return value;
}

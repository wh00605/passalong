// File storage: Supabase Storage in production, local ./.uploads folder in development.
// Public files (listing photos) get public URLs; private files (chat photos, dispute evidence)
// are only ever served through /api/files/private/... after a permission check.
import { mkdir, readFile, writeFile, unlink } from "node:fs/promises";
import path from "node:path";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";

export type Visibility = "public" | "private";

const LOCAL_ROOT = path.resolve(".uploads");

function useSupabase() {
  return (
    Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY) &&
    process.env.LOCAL_UPLOADS !== "true"
  );
}

let supabase: SupabaseClient | null = null;
function client() {
  supabase ??= createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, {
    auth: { persistSession: false },
  });
  return supabase;
}

function bucket(v: Visibility) {
  return v === "public"
    ? (process.env.SUPABASE_PUBLIC_BUCKET ?? "listing-photos")
    : (process.env.SUPABASE_PRIVATE_BUCKET ?? "private-uploads");
}

function assertSafeKey(key: string) {
  if (!/^[a-zA-Z0-9/_.-]+$/.test(key) || key.includes("..")) throw new Error("Invalid storage key");
}

export async function putObject(key: string, body: Buffer, contentType: string, visibility: Visibility) {
  assertSafeKey(key);
  if (useSupabase()) {
    const { error } = await client().storage.from(bucket(visibility)).upload(key, body, {
      contentType,
      upsert: true,
      cacheControl: "31536000",
    });
    if (error) throw new Error(`Upload failed: ${error.message}`);
    return;
  }
  if (process.env.NODE_ENV === "production" && process.env.LOCAL_UPLOADS !== "true") {
    throw new Error("File storage is not configured. Set the Supabase environment variables.");
  }
  const file = path.join(LOCAL_ROOT, visibility, key);
  await mkdir(path.dirname(file), { recursive: true });
  await writeFile(file, body);
}

export async function getObject(key: string, visibility: Visibility): Promise<Buffer | null> {
  assertSafeKey(key);
  if (useSupabase()) {
    const { data, error } = await client().storage.from(bucket(visibility)).download(key);
    if (error || !data) return null;
    return Buffer.from(await data.arrayBuffer());
  }
  try {
    return await readFile(path.join(LOCAL_ROOT, visibility, key));
  } catch {
    return null;
  }
}

export async function deleteObjects(keys: string[], visibility: Visibility) {
  if (keys.length === 0) return;
  keys.forEach(assertSafeKey);
  if (useSupabase()) {
    await client().storage.from(bucket(visibility)).remove(keys);
    return;
  }
  await Promise.all(keys.map((k) => unlink(path.join(LOCAL_ROOT, visibility, k)).catch(() => {})));
}

/** URL for a public object. */
export function publicUrl(key: string): string {
  if (useSupabase()) {
    return `${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/${bucket("public")}/${key}`;
  }
  return `/api/files/public/${key}`;
}

/** Short-lived signed URL for a private object (Supabase only). */
export async function signedUrl(key: string, seconds = 300): Promise<string | null> {
  if (!useSupabase()) return null;
  const { data } = await client().storage.from(bucket("private")).createSignedUrl(key, seconds);
  return data?.signedUrl ?? null;
}

/** URL for a public listing photo variant (see PHOTO_WIDTHS in images.ts). */
export function photoUrl(storageKey: string, width: 320 | 640 | 1280 = 640): string {
  return publicUrl(`${storageKey}-${width}.webp`);
}

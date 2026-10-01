import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getCurrentUser } from "@/lib/session";
import { processAndStoreImage, ImageError, MAX_UPLOAD_BYTES } from "@/lib/images";
import { photoUrl } from "@/lib/storage";
import { checkRateLimit } from "@/lib/rate-limit";

export const runtime = "nodejs";

/** Uploads one listing photo. It stays unattached until the listing is saved. */
export async function POST(req: Request) {
  const user = await getCurrentUser();
  if (!user || !user.emailVerified) return NextResponse.json({ error: "Please log in." }, { status: 401 });
  if (user.banned) return NextResponse.json({ error: "Your account is restricted." }, { status: 403 });
  if (!(await checkRateLimit(`photo-upload:${user.id}`, 200, 3600))) {
    return NextResponse.json({ error: "You've uploaded a lot of photos – please wait a bit." }, { status: 429 });
  }

  const len = Number(req.headers.get("content-length") ?? 0);
  if (len > MAX_UPLOAD_BYTES + 100_000) return NextResponse.json({ error: "Photos must be 10 MB or smaller." }, { status: 413 });

  const form = await req.formData().catch(() => null);
  const file = form?.get("file");
  if (!(file instanceof File) || file.size === 0) return NextResponse.json({ error: "No photo received." }, { status: 400 });

  try {
    const processed = await processAndStoreImage(Buffer.from(await file.arrayBuffer()), { prefix: `listings/${user.id}`, visibility: "public" });
    const photo = await db.listingPhoto.create({
      data: { uploaderId: user.id, storageKey: processed.storageKey, width: processed.width, height: processed.height, blurData: processed.blurData },
    });
    return NextResponse.json({ id: photo.id, url: photoUrl(photo.storageKey, 320), width: photo.width, height: photo.height });
  } catch (err) {
    if (err instanceof ImageError) return NextResponse.json({ error: err.message }, { status: 400 });
    console.error("[upload]", err);
    return NextResponse.json({ error: "Upload failed. Please try again." }, { status: 500 });
  }
}

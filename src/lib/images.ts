// Image processing: validates real image content, strips metadata (EXIF/GPS),
// auto-rotates, and writes compressed WebP variants.
import sharp, { type Metadata } from "sharp";
import { randomUUID } from "node:crypto";
import { putObject, type Visibility } from "@/lib/storage";

export const PHOTO_WIDTHS = [320, 640, 1280] as const;
export const MAX_UPLOAD_BYTES = 10 * 1024 * 1024;
const ALLOWED_FORMATS = new Set(["jpeg", "png", "webp", "avif", "heif", "gif"]);

export type ProcessedImage = { storageKey: string; width: number; height: number; blurData: string };

export class ImageError extends Error {}

export async function processAndStoreImage(
  input: Buffer,
  opts: { prefix: string; visibility: Visibility },
): Promise<ProcessedImage> {
  if (input.byteLength > MAX_UPLOAD_BYTES) throw new ImageError("Photos must be 10 MB or smaller.");

  let meta: Metadata;
  try {
    meta = await sharp(input, { limitInputPixels: 50_000_000 }).metadata();
  } catch {
    throw new ImageError("That file isn't a photo we can read. Please upload a JPEG, PNG, WebP or HEIC image.");
  }
  if (!meta.format || !ALLOWED_FORMATS.has(meta.format)) {
    throw new ImageError("Please upload a JPEG, PNG, WebP or HEIC image.");
  }

  // .rotate() applies EXIF orientation; sharp drops all metadata (including GPS) on output by default.
  const base = sharp(input, { limitInputPixels: 50_000_000 }).rotate();
  const { width = 0, height = 0 } = await base
    .clone()
    .resize({ width: PHOTO_WIDTHS.at(-1), withoutEnlargement: true })
    .toBuffer({ resolveWithObject: true })
    .then((r) => r.info);

  const key = `${opts.prefix}/${randomUUID()}`;
  await Promise.all(
    PHOTO_WIDTHS.map(async (w) => {
      const buf = await base.clone().resize({ width: w, withoutEnlargement: true }).webp({ quality: 75 }).toBuffer();
      await putObject(`${key}-${w}.webp`, buf, "image/webp", opts.visibility);
    }),
  );

  const blur = await base.clone().resize(16, 16, { fit: "inside" }).webp({ quality: 40 }).toBuffer();
  return { storageKey: key, width, height, blurData: `data:image/webp;base64,${blur.toString("base64")}` };
}

export { photoUrl } from "@/lib/storage";

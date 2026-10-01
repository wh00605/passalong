"use client";
import { useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";

export type GalleryPhoto = { src: string; srcSet: string; width: number; height: number; blurData: string | null };

export function Gallery({ photos, title }: { photos: GalleryPhoto[]; title: string }) {
  const [i, setI] = useState(0);
  if (photos.length === 0) {
    return <div className="flex aspect-[4/5] items-center justify-center rounded-md border-2 border-ink bg-brand-50 font-mono text-sm text-muted">No photos</div>;
  }
  const p = photos[i];
  const go = (d: number) => setI((x) => (x + d + photos.length) % photos.length);
  return (
    <section aria-roledescription="carousel" aria-label={`Photos of ${title}`}>
      <div className="relative overflow-hidden rounded-md border-2 border-ink bg-brand-50">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          key={p.src}
          src={p.src}
          srcSet={p.srcSet}
          sizes="(min-width: 1024px) 560px, 100vw"
          width={p.width}
          height={p.height}
          alt={`${title} – photo ${i + 1} of ${photos.length}`}
          fetchPriority={i === 0 ? "high" : "auto"}
          className="aspect-[4/5] w-full object-contain"
          style={p.blurData ? { backgroundImage: `url(${p.blurData})`, backgroundSize: "cover" } : undefined}
        />
        {photos.length > 1 && (
          <>
            <button type="button" onClick={() => go(-1)} aria-label="Previous photo" className="absolute top-1/2 left-2 inline-flex h-11 w-11 -translate-y-1/2 items-center justify-center rounded-md border-2 border-ink bg-surface hover:bg-accent-400">
              <ChevronLeft className="h-5 w-5" aria-hidden="true" />
            </button>
            <button type="button" onClick={() => go(1)} aria-label="Next photo" className="absolute top-1/2 right-2 inline-flex h-11 w-11 -translate-y-1/2 items-center justify-center rounded-md border-2 border-ink bg-surface hover:bg-accent-400">
              <ChevronRight className="h-5 w-5" aria-hidden="true" />
            </button>
            <span className="absolute bottom-2 left-2 rounded-sm bg-ink px-2 py-0.5 font-mono text-xs text-surface" aria-live="polite">
              {i + 1} / {photos.length}
            </span>
          </>
        )}
      </div>
      {photos.length > 1 && (
        <ul className="mt-2 grid grid-cols-6 gap-2" role="list">
          {photos.map((ph, idx) => (
            <li key={ph.src}>
              <button
                type="button"
                onClick={() => setI(idx)}
                aria-label={`Show photo ${idx + 1}`}
                aria-current={idx === i}
                className={`block overflow-hidden rounded-sm border-2 ${idx === i ? "border-ink ring-2 ring-accent-400" : "border-ink/30 hover:border-ink"}`}
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={ph.src.replace("-1280.webp", "-320.webp").replace("-640.webp", "-320.webp")} alt="" loading="lazy" className="aspect-square w-full object-cover" />
              </button>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

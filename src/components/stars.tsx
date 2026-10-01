import { Star } from "lucide-react";

export function Stars({ rating, count, size = 16 }: { rating: number; count?: number; size?: number }) {
  const rounded = Math.round(rating * 2) / 2;
  return (
    <span className="inline-flex items-center gap-1">
      <span className="inline-flex" aria-hidden="true">
        {[1, 2, 3, 4, 5].map((i) => (
          <Star
            key={i}
            style={{ width: size, height: size }}
            className={i <= rounded ? "fill-accent-400 text-accent-600" : i - 0.5 === rounded ? "fill-accent-300 text-accent-600" : "text-line-strong"}
          />
        ))}
      </span>
      <span className="sr-only">Rated {rating.toFixed(1)} out of 5</span>
      {count != null && <span className="text-sm text-muted">({count}<span className="sr-only"> reviews</span>)</span>}
    </span>
  );
}

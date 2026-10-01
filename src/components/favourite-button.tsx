"use client";
import Link from "next/link";
import { useOptimistic, useTransition } from "react";
import { Heart } from "lucide-react";
import { toggleFavouriteAction } from "@/app/actions/favourites";

export function FavouriteButton({
  listingId,
  initial,
  count,
  signedIn,
  title,
  variant = "overlay",
}: {
  listingId: string;
  initial: boolean;
  count: number;
  signedIn: boolean;
  title: string;
  variant?: "overlay" | "full";
}) {
  const [pending, start] = useTransition();
  const [state, setOptimistic] = useOptimistic({ on: initial, count }, (s, on: boolean) => ({
    on,
    count: s.count + (on ? 1 : -1),
  }));

  const cls =
    variant === "overlay"
      ? "relative z-10 inline-flex h-9 min-w-9 items-center justify-center gap-1 rounded-full bg-surface/95 px-2.5 text-xs font-medium text-ink shadow-[0_2px_8px_rgba(26,23,20,0.12)] backdrop-blur transition-colors hover:bg-surface"
      : "btn-secondary";

  if (!signedIn) {
    return (
      <Link href="/login" className={cls} aria-label={`Log in to favourite ${title}`}>
        <Heart className="h-4 w-4" aria-hidden="true" />
        {variant === "full" ? "Favourite" : count > 0 ? count : null}
      </Link>
    );
  }

  return (
    <button
      type="button"
      className={cls}
      aria-pressed={state.on}
      aria-label={state.on ? `Remove ${title} from favourites` : `Add ${title} to favourites`}
      disabled={pending}
      onClick={() =>
        start(async () => {
          setOptimistic(!state.on);
          await toggleFavouriteAction(listingId);
        })
      }
    >
      <Heart className={`h-4 w-4 ${state.on ? "fill-danger text-danger" : ""}`} aria-hidden="true" />
      {variant === "full" ? (state.on ? "Favourited" : "Favourite") : state.count > 0 ? state.count : null}
    </button>
  );
}

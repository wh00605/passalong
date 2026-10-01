"use client";
import Link from "next/link";
import { useEffect } from "react";

export default function ErrorPage({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    console.error(error);
  }, [error]);
  return (
    <div className="container-page max-w-xl py-20 text-center">
      <p className="font-mono text-sm tracking-[0.2em] text-muted">SOMETHING WENT WRONG</p>
      <h1 className="mt-3 text-4xl font-medium">Sorry – that didn&apos;t work.</h1>
      <p className="mt-4 text-muted">Please try again. If it keeps happening, contact us{error.digest ? ` and quote ${error.digest}` : ""}.</p>
      <div className="mt-8 flex justify-center gap-3">
        <button type="button" onClick={reset} className="btn-primary">Try again</button>
        <Link href="/contact" className="btn-secondary">Contact us</Link>
      </div>
    </div>
  );
}

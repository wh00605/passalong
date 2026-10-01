import Link from "next/link";

export default function NotFound() {
  return (
    <div className="container-page max-w-xl py-20 text-center">
      <p className="font-mono text-sm tracking-[0.2em] text-muted">ERROR 404</p>
      <h1 className="mt-3 text-5xl font-medium">This one&apos;s already been passed along.</h1>
      <p className="mt-4 text-muted">The page or item you&apos;re looking for isn&apos;t here – it may have sold or been removed.</p>
      <div className="mt-8 flex justify-center gap-3">
        <Link href="/" className="btn-primary">Back to home</Link>
        <Link href="/search?sort=newest" className="btn-secondary">Browse new items</Link>
      </div>
    </div>
  );
}

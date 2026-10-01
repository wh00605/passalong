import Link from "next/link";

export default function Forbidden() {
  return (
    <div className="container-page max-w-xl py-20 text-center">
      <p className="font-mono text-sm tracking-[0.2em] text-muted">ERROR 403</p>
      <h1 className="mt-3 text-4xl font-medium">You don&apos;t have access to this page.</h1>
      <Link href="/" className="btn-primary mt-8">Back to home</Link>
    </div>
  );
}

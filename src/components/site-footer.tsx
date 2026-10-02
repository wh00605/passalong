import Link from "next/link";
import { LogoMark } from "@/components/logo";

const SECTIONS = [
  {
    title: "Passalong",
    links: [
      { href: "/about", label: "About us" },
      { href: "/help/how-selling-works", label: "How selling works" },
      { href: "/help/buyer-protection", label: "Buyer Protection" },
      { href: "/help", label: "Help centre" },
      { href: "/contact", label: "Contact us" },
    ],
  },
  {
    title: "Policies",
    links: [
      { href: "/legal/terms", label: "Terms of service" },
      { href: "/legal/privacy", label: "Privacy policy" },
      { href: "/legal/cookies", label: "Cookie policy" },
      { href: "/legal/buyer-protection", label: "Buyer Protection terms" },
      { href: "/legal/prohibited-items", label: "Prohibited items" },
      { href: "/legal/catalogue-rules", label: "Catalogue rules" },
    ],
  },
  {
    title: "Safety",
    links: [
      { href: "/help/staying-safe", label: "Staying safe" },
      { href: "/report-illegal-content", label: "Report illegal content" },
      { href: "/legal/accessibility", label: "Accessibility statement" },
      { href: "/legal/cookies#manage", label: "Cookie settings" },
    ],
  },
];

export function SiteFooter() {
  return (
    <footer className="mt-20 border-t border-line bg-shade">
      <div className="container-page grid gap-10 py-12 sm:grid-cols-2 lg:grid-cols-[1.4fr_1fr_1fr_1fr]">
        <div>
          <div className="flex items-center gap-2">
            <LogoMark className="h-8 w-8" />
            <span className="text-[1.35rem] font-bold tracking-[-0.04em] text-brand-600">passalong</span>
          </div>
          <p className="mt-4 max-w-xs text-sm text-muted">Buy and sell pre-loved fashion and more, from people across the UK.</p>
        </div>
        {SECTIONS.map((s) => (
          <nav key={s.title} aria-labelledby={`footer-${s.title}`}>
            <h2 id={`footer-${s.title}`} className="text-sm font-semibold tracking-normal text-ink">
              {s.title}
            </h2>
            <ul className="mt-3 space-y-0.5 text-sm" role="list">
              {s.links.map((l) => (
                <li key={l.href}>
                  <Link href={l.href} className="inline-flex min-h-8 items-center text-muted transition-colors hover:text-ink hover:underline">
                    {l.label}
                  </Link>
                </li>
              ))}
            </ul>
          </nav>
        ))}
      </div>
      <div className="border-t border-line">
        <p className="container-page flex flex-wrap justify-between gap-2 py-5 text-xs text-muted">
          <span>© {new Date().getFullYear()} Passalong. All prices in GBP.</span>
          <span>Made in the UK</span>
        </p>
      </div>
    </footer>
  );
}

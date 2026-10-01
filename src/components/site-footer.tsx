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
    <footer className="mt-20 bg-ink text-surface">
      <div className="container-page grid gap-8 py-10 sm:grid-cols-2 lg:grid-cols-4">
        <div>
          <LogoMark className="h-10 w-10 [&_path:first-child]:fill-surface [&_path:last-child]:stroke-ink" />
          <p className="mt-3 max-w-xs text-sm text-brand-100">
            Buy and sell pre-loved fashion and more across the UK. Give good things a second home.
          </p>
        </div>
        {SECTIONS.map((s) => (
          <nav key={s.title} aria-labelledby={`footer-${s.title}`}>
            <h2 id={`footer-${s.title}`} className="font-mono text-xs font-medium tracking-[0.14em] text-accent-400 uppercase">
              {s.title}
            </h2>
            <ul className="mt-3 space-y-1 text-sm">
              {s.links.map((l) => (
                <li key={l.href}>
                  <Link href={l.href} className="inline-flex min-h-8 items-center text-brand-100 hover:text-accent-400 hover:underline">
                    {l.label}
                  </Link>
                </li>
              ))}
            </ul>
          </nav>
        ))}
      </div>
      <p aria-hidden="true" className="container-page overflow-hidden font-display text-[clamp(4rem,17vw,15rem)] leading-[0.8] font-extrabold tracking-[-0.06em] text-surface/10 select-none">passalong</p>
      <div className="border-t border-surface/20">
        <p className="container-page py-4 font-mono text-xs text-brand-200">
          © {new Date().getFullYear()} Passalong. All prices in GBP.
        </p>
      </div>
    </footer>
  );
}

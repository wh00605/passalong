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
    <footer className="mt-28 bg-brand-800 text-white">
      <div className="container-page grid gap-10 py-16 sm:grid-cols-2 lg:grid-cols-[1.4fr_1fr_1fr_1fr]">
        <div>
          <div className="flex items-center gap-2.5">
            <LogoMark className="h-9 w-9" inverted />
            <span className="font-display text-2xl" style={{ fontVariationSettings: '"opsz" 144, "SOFT" 50', fontWeight: 500 }}>Passalong</span>
          </div>
          <p className="mt-5 max-w-xs font-display text-xl leading-snug text-brand-100" style={{ fontVariationSettings: '"opsz" 72, "SOFT" 100' }}>
            <em>Good things deserve a second home.</em>
          </p>
        </div>
        {SECTIONS.map((s) => (
          <nav key={s.title} aria-labelledby={`footer-${s.title}`}>
            <h2 id={`footer-${s.title}`} className="font-sans text-[0.7rem] font-medium tracking-[0.18em] text-[#e2c9a0] uppercase">
              {s.title}
            </h2>
            <ul className="mt-4 space-y-1.5 text-sm" role="list">
              {s.links.map((l) => (
                <li key={l.href}>
                  <Link href={l.href} className="inline-flex min-h-8 items-center text-brand-100 transition-colors hover:text-white">
                    {l.label}
                  </Link>
                </li>
              ))}
            </ul>
          </nav>
        ))}
      </div>
      <div className="border-t border-white/10">
        <p className="container-page flex flex-wrap justify-between gap-2 py-6 text-xs text-brand-200">
          <span>© {new Date().getFullYear()} Passalong. All prices in GBP.</span>
          <span>Made in the UK</span>
        </p>
      </div>
    </footer>
  );
}

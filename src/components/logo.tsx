/** Original mark: two fine arcs handing something on, inside an indigo seal. */
export function LogoMark({ className = "h-8 w-8", inverted = false }: { className?: string; inverted?: boolean }) {
  const bg = inverted ? "#ffffff" : "#2e2862";
  const fg = inverted ? "#2e2862" : "#ffffff";
  return (
    <svg viewBox="0 0 32 32" className={className} aria-hidden="true" focusable="false">
      <circle cx="16" cy="16" r="16" fill={bg} />
      <path d="M9.5 18.5a6.5 6.5 0 0 1 11.6-4" fill="none" stroke="#c9a46a" strokeWidth="1.8" strokeLinecap="round" />
      <path d="M22.5 13.5a6.5 6.5 0 0 1-11.6 4" fill="none" stroke={fg} strokeWidth="1.8" strokeLinecap="round" />
      <path d="M20.9 10.6l.3 4-3.9-.6" fill="none" stroke="#c9a46a" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M11.1 21.4l-.3-4 3.9.6" fill="none" stroke={fg} strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export function Logo({ compactOnSmall = false }: { compactOnSmall?: boolean }) {
  return (
    <span className="inline-flex items-center gap-2">
      <LogoMark className="h-8 w-8" />
      <span
        className={`font-display text-[1.6rem] leading-none tracking-[-0.02em] text-brand-600 ${compactOnSmall ? "max-[430px]:hidden" : ""}`}
        style={{ fontVariationSettings: '"opsz" 144, "SOFT" 50', fontWeight: 500 }}
      >
        Passalong
      </span>
    </span>
  );
}

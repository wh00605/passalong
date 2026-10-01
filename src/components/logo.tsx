/** Original mark: a swing tag with a lime eyelet – "pass it along". */
export function LogoMark({ className = "h-8 w-8" }: { className?: string }) {
  return (
    <svg viewBox="0 0 32 32" className={className} aria-hidden="true" focusable="false">
      <g transform="rotate(-12 16 16)">
        <path d="M11 4h10l6 6v16a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V10z" fill="#121212" />
        <circle cx="16" cy="10" r="3.2" fill="#c8f53a" />
        <path d="M10 18h12M10 22.5h7" stroke="#fbfaf6" strokeWidth="2.2" strokeLinecap="round" />
      </g>
    </svg>
  );
}

export function Logo() {
  return (
    <span className="inline-flex items-center gap-1.5">
      <LogoMark />
      <span className="font-display text-[1.45rem] leading-none font-extrabold tracking-[-0.04em] text-ink">
        passalong
      </span>
    </span>
  );
}

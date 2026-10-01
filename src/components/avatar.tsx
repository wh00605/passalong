const COLOURS = ["#121212", "#1d6b34", "#8a3b12", "#1f4f8a", "#6b2d6b", "#4f5f00"];

export function Avatar({ name, image, size = 40 }: { name: string; image?: string | null; size?: number }) {
  if (image) {
    // eslint-disable-next-line @next/next/no-img-element
    return <img src={image} alt="" width={size} height={size} className="shrink-0 rounded-full border border-line object-cover" style={{ width: size, height: size }} />;
  }
  const initials = name
    .split(/\s+/)
    .map((p) => p[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();
  const colour = COLOURS[[...name].reduce((a, c) => a + c.charCodeAt(0), 0) % COLOURS.length];
  return (
    <span
      aria-hidden="true"
      className="inline-flex shrink-0 items-center justify-center rounded-full font-display font-bold text-surface"
      style={{ width: size, height: size, background: colour, fontSize: size * 0.4 }}
    >
      {initials || "?"}
    </span>
  );
}

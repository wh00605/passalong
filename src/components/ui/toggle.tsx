/** Accessible on/off switch built on a native checkbox (works without JavaScript). */
export function Toggle({ name, label, description, defaultChecked }: { name: string; label: string; description?: string; defaultChecked?: boolean }) {
  const id = `t-${name}`;
  return (
    <div className="flex items-start justify-between gap-4 border-b border-line py-4 last:border-0">
      <label htmlFor={id} className="cursor-pointer">
        <span className="block font-semibold">{label}</span>
        {description && <span id={`${id}-d`} className="mt-0.5 block text-sm text-muted">{description}</span>}
      </label>
      <span className="relative inline-flex shrink-0">
        <input
          id={id}
          type="checkbox"
          role="switch"
          name={name}
          defaultChecked={defaultChecked}
          aria-describedby={description ? `${id}-d` : undefined}
          className="peer h-7 w-12 cursor-pointer appearance-none rounded-full border border-line bg-surface transition-colors checked:bg-accent-400"
        />
        <span aria-hidden="true" className="pointer-events-none absolute top-1 left-1 h-5 w-5 rounded-full bg-ink transition-transform peer-checked:translate-x-5" />
      </span>
    </div>
  );
}

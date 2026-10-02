"use client";
import { useEffect, useId, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Search } from "lucide-react";

type Suggestion = { type: "query" | "brand" | "category"; label: string; href: string };

/** Accessible autocomplete following the ARIA 1.2 combobox pattern. */
export function SearchBox({ className = "" }: { className?: string }) {
  const router = useRouter();
  const params = useSearchParams();
  const [value, setValue] = useState(params.get("q") ?? "");
  const [fetched, setItems] = useState<Suggestion[]>([]);
  const items = value.trim().length < 2 ? [] : fetched;
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(-1);
  const listId = useId();
  const abortRef = useRef<AbortController | null>(null);

  useEffect(() => {
    const q = value.trim();
    if (q.length < 2) return;
    const t = setTimeout(async () => {
      abortRef.current?.abort();
      const ctrl = new AbortController();
      abortRef.current = ctrl;
      try {
        const res = await fetch(`/api/search/suggest?q=${encodeURIComponent(q)}`, { signal: ctrl.signal });
        if (res.ok) {
          const data = (await res.json()) as { suggestions: Suggestion[] };
          setItems(data.suggestions);
          setActive(-1);
        }
      } catch {
        /* aborted */
      }
    }, 180);
    return () => clearTimeout(t);
  }, [value]);

  useEffect(() => {
    // "/" focuses search, like many power-user tools.
    const onKey = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement;
      if (e.key !== "/" || t.isContentEditable || ["INPUT", "TEXTAREA", "SELECT"].includes(t.tagName)) return;
      const input = document.querySelectorAll<HTMLInputElement>("input[name=q]");
      const visible = [...input].find((i) => i.offsetParent !== null);
      if (visible) {
        e.preventDefault();
        visible.focus();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const showList = open && items.length > 0;

  function go(href: string) {
    setOpen(false);
    router.push(href);
  }

  return (
    <form
      role="search"
      action="/search"
      className={`relative ${className}`}
      onSubmit={(e) => {
        e.preventDefault();
        if (active >= 0 && items[active]) return go(items[active].href);
        go(`/search?q=${encodeURIComponent(value.trim())}`);
      }}
    >
      <label htmlFor={`${listId}-input`} className="sr-only">
        Search for items
      </label>
      <Search className="pointer-events-none absolute top-1/2 left-3.5 h-[1.1rem] w-[1.1rem] -translate-y-1/2 text-subtle" strokeWidth={1.8} aria-hidden="true" />
      <input
        id={`${listId}-input`}
        name="q"
        type="search"
        role="combobox"
        aria-expanded={showList}
        aria-controls={listId}
        aria-autocomplete="list"
        aria-activedescendant={active >= 0 ? `${listId}-${active}` : undefined}
        autoComplete="off"
        placeholder="Search for items, brands…"
        className="input rounded-full border-line bg-surface pr-14 pl-10 hover:border-line-strong"
        value={value}
        onChange={(e) => {
          setValue(e.target.value);
          setOpen(true);
        }}
        onFocus={() => setOpen(true)}
        onBlur={() => setTimeout(() => setOpen(false), 120)}
        onKeyDown={(e) => {
          if (!showList) return;
          if (e.key === "ArrowDown") {
            e.preventDefault();
            setActive((a) => (a + 1) % items.length);
          } else if (e.key === "ArrowUp") {
            e.preventDefault();
            setActive((a) => (a <= 0 ? items.length - 1 : a - 1));
          } else if (e.key === "Escape") {
            setOpen(false);
          }
        }}
      />
      <button type="submit" className="absolute top-1/2 right-1.5 inline-flex h-9 w-9 -translate-y-1/2 items-center justify-center rounded-full bg-brand-600 text-white hover:bg-brand-700">
        <Search className="h-4 w-4" strokeWidth={2.2} aria-hidden="true" />
        <span className="sr-only">Search</span>
      </button>
      <ul
        id={listId}
        role="listbox"
        aria-label="Search suggestions"
        hidden={!showList}
        className="absolute top-full right-0 left-0 z-50 mt-2 overflow-hidden rounded-lg border border-line bg-surface py-1 shadow-[var(--shadow-tag)]"
      >
        {items.map((s, i) => (
          <li
            key={`${s.type}-${s.href}`}
            id={`${listId}-${i}`}
            role="option"
            aria-selected={i === active}
            className={`flex cursor-pointer items-center justify-between px-4 py-2.5 text-sm ${i === active ? "bg-brand-50" : ""}`}
            onMouseDown={(e) => {
              e.preventDefault();
              go(s.href);
            }}
          >
            <span>{s.label}</span>
            {s.type !== "query" && <span className="text-xs text-muted">{s.type === "brand" ? "Brand" : "Category"}</span>}
          </li>
        ))}
      </ul>
      <div aria-live="polite" className="sr-only">
        {showList ? `${items.length} suggestions available. Use up and down arrows to choose.` : ""}
      </div>
    </form>
  );
}

// Pure prohibited-term matching (unit tested). DB access lives in moderation.ts.

export type Term = { term: string; severity: "BLOCK" | "REVIEW"; note?: string | null };
export type ProhibitedResult = { blocked: Term[]; review: Term[] };

function normalise(text: string) {
  return ` ${text
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9:+&\s-]/g, " ")
    .replace(/\s+/g, " ")} `;
}

function escapeRegex(s: string) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/** Whole-word / whole-phrase match, so "gun" doesn't match "gunmetal" and "fake" doesn't match "faker". */
export function matchProhibited(text: string, terms: Term[]): ProhibitedResult {
  const hay = normalise(text);
  const hits = terms.filter((t) => {
    const needle = normalise(t.term).trim();
    if (!needle) return false;
    const re = new RegExp(`(^|[\\s-])${escapeRegex(needle)}s?(?=[\\s-]|$)`);
    return re.test(hay);
  });
  return { blocked: hits.filter((h) => h.severity === "BLOCK"), review: hits.filter((h) => h.severity === "REVIEW") };
}

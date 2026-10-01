import Link from "next/link";
import type { ReactNode } from "react";

/** Inline: **bold**, [text](url). Only relative or https links are allowed. */
function inline(text: string, key: string): ReactNode[] {
  const out: ReactNode[] = [];
  const re = /\*\*([^*]+)\*\*|\[([^\]]+)\]\(([^)\s]+)\)/g;
  let last = 0;
  let m: RegExpExecArray | null;
  let i = 0;
  while ((m = re.exec(text))) {
    if (m.index > last) out.push(text.slice(last, m.index));
    if (m[1]) out.push(<strong key={`${key}-b${i++}`}>{m[1]}</strong>);
    else {
      const href = m[3];
      if (href.startsWith("/")) out.push(<Link key={`${key}-l${i++}`} href={href} className="link">{m[2]}</Link>);
      else if (href.startsWith("https://")) out.push(<a key={`${key}-l${i++}`} href={href} className="link" rel="noopener noreferrer" target="_blank">{m[2]}</a>);
      else out.push(m[2]);
    }
    last = m.index + m[0].length;
  }
  if (last < text.length) out.push(text.slice(last));
  return out;
}

/** Minimal, safe Markdown → React (no HTML injection possible). */
export function Markdown({ source }: { source: string }) {
  const blocks = source.replace(/\r\n/g, "\n").split(/\n{2,}/);
  return (
    <div className="space-y-4 leading-relaxed">
      {blocks.map((block, b) => {
        const lines = block.split("\n");
        const key = `b${b}`;
        if (/^#{2,3} /.test(lines[0]) && lines.length === 1) {
          const level = lines[0].startsWith("### ") ? 3 : 2;
          const text = lines[0].replace(/^#{2,3} /, "");
          return level === 2 ? <h2 key={key} className="pt-2 text-2xl font-extrabold">{inline(text, key)}</h2> : <h3 key={key} className="text-lg font-bold">{inline(text, key)}</h3>;
        }
        if (lines.every((l) => /^- /.test(l))) {
          return <ul key={key} className="list-disc space-y-1 pl-6">{lines.map((l, i) => <li key={i}>{inline(l.slice(2), `${key}-${i}`)}</li>)}</ul>;
        }
        if (lines.every((l) => /^\d+\. /.test(l))) {
          return <ol key={key} className="list-decimal space-y-1 pl-6">{lines.map((l, i) => <li key={i}>{inline(l.replace(/^\d+\. /, ""), `${key}-${i}`)}</li>)}</ol>;
        }
        // Mixed block: a heading line followed by content.
        if (/^#{2,3} /.test(lines[0])) {
          return (
            <div key={key} className="space-y-3">
              <h2 className="pt-2 text-2xl font-extrabold">{inline(lines[0].replace(/^#{2,3} /, ""), key)}</h2>
              <Markdown source={lines.slice(1).join("\n")} />
            </div>
          );
        }
        return <p key={key}>{inline(lines.join(" "), key)}</p>;
      })}
    </div>
  );
}

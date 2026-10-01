const rtf = new Intl.RelativeTimeFormat("en-GB", { numeric: "auto" });

export function timeAgo(date: Date, now = new Date()): string {
  const s = Math.round((date.getTime() - now.getTime()) / 1000);
  const abs = Math.abs(s);
  if (abs < 60) return "just now";
  if (abs < 3600) return rtf.format(Math.round(s / 60), "minute");
  if (abs < 86_400) return rtf.format(Math.round(s / 3600), "hour");
  if (abs < 86_400 * 30) return rtf.format(Math.round(s / 86_400), "day");
  if (abs < 86_400 * 365) return rtf.format(Math.round(s / (86_400 * 30)), "month");
  return rtf.format(Math.round(s / (86_400 * 365)), "year");
}

export function formatDate(date: Date): string {
  return date.toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric", timeZone: "Europe/London" });
}

export function formatDateTime(date: Date): string {
  return date.toLocaleString("en-GB", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit", timeZone: "Europe/London" });
}

export function responseTimeLabel(minutes: number | null | undefined): string | null {
  if (minutes == null) return null;
  if (minutes < 60) return "Usually responds within an hour";
  if (minutes < 60 * 24) return `Usually responds within ${Math.ceil(minutes / 60)} hours`;
  return `Usually responds within ${Math.ceil(minutes / (60 * 24))} days`;
}

/** Adds UK working days (Mon–Fri; bank holidays not excluded – see TODO in README). */
export function addWorkingDays(start: Date, days: number): Date {
  const d = new Date(start);
  let added = 0;
  while (added < days) {
    d.setDate(d.getDate() + 1);
    const day = d.getDay();
    if (day !== 0 && day !== 6) added++;
  }
  return d;
}

export function addDays(start: Date, days: number): Date {
  return new Date(start.getTime() + days * 86_400_000);
}

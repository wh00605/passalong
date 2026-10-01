export const USERNAME_PATTERN = /^[a-z0-9_]{3,20}$/;

const RESERVED = new Set([
  "admin", "administrator", "support", "help", "passalong", "staff", "moderator", "mod",
  "official", "settings", "api", "login", "signup", "system", "root", "security", "team",
]);

export function normaliseUsername(input: string): string {
  return input.trim().toLowerCase();
}

export function validateUsername(input: string): string | null {
  const u = normaliseUsername(input);
  if (!USERNAME_PATTERN.test(u)) return "Usernames are 3–20 characters: lowercase letters, numbers and underscores.";
  if (RESERVED.has(u)) return "That username is reserved. Please choose another.";
  return null;
}

/** Builds a username candidate from a display name, e.g. "Amy O'Neil" → "amyoneil". */
export function usernameFromName(name: string): string {
  const base = name
    .normalize("NFKD")
    .replace(/[^\w\s]/g, "")
    .toLowerCase()
    .replace(/\s+/g, "")
    .replace(/[^a-z0-9_]/g, "")
    .slice(0, 14);
  return base.length >= 3 ? base : `member${base}`;
}

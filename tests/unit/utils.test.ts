import { describe, expect, it } from "vitest";
import { formatPence, parsePounds, percentOf } from "@/lib/money";
import { normaliseUsername, usernameFromName, validateUsername } from "@/lib/username";
import { safeNext } from "@/lib/safe-next";
import { listingIdFromParam, listingPath, slugify } from "@/lib/slug";
import { addWorkingDays } from "@/lib/time";
import { buildSearchText } from "@/lib/search-text";

describe("money", () => {
  it("formats GBP", () => {
    expect(formatPence(1965)).toBe("£19.65");
    expect(formatPence(100000)).toBe("£1,000.00");
  });
  it("parses pound strings safely", () => {
    expect(parsePounds("12.5")).toBe(1250);
    expect(parsePounds("£1,200")).toBe(120000);
    expect(parsePounds("12.345")).toBeNull();
    expect(parsePounds("-5")).toBeNull();
    expect(parsePounds("abc")).toBeNull();
  });
  it("computes basis points", () => {
    expect(percentOf(1000, 500)).toBe(50);
  });
});

describe("usernames", () => {
  it("validates format and reserved names", () => {
    expect(validateUsername("amelia_w")).toBeNull();
    expect(validateUsername("ab")).not.toBeNull();
    expect(validateUsername("Has Space")).not.toBeNull();
    expect(validateUsername("admin")).not.toBeNull();
    expect(normaliseUsername("  Amelia ")).toBe("amelia");
  });
  it("derives a username from a name", () => {
    expect(usernameFromName("Amy O'Neil")).toBe("amyoneil");
    expect(usernameFromName("Zé")).toMatch(/^member/);
  });
});

describe("safeNext (open redirect protection)", () => {
  it("allows relative paths only", () => {
    expect(safeNext("/orders/1")).toBe("/orders/1");
    expect(safeNext("https://evil.example")).toBe("/");
    expect(safeNext("//evil.example")).toBe("/");
    expect(safeNext("/\\evil.example")).toBe("/");
    expect(safeNext(undefined, "/x")).toBe("/x");
  });
});

describe("slugs", () => {
  it("builds clean listing URLs", () => {
    expect(slugify("Levi's 501 Jeans & Jacket")).toBe("levis-501-jeans-and-jacket");
    expect(listingPath({ id: "abc123", title: "Zara Dress!" })).toBe("/items/abc123-zara-dress");
    expect(listingIdFromParam("abc123-zara-dress")).toBe("abc123");
  });
});

describe("addWorkingDays", () => {
  it("skips weekends", () => {
    const friday = new Date("2026-10-02T12:00:00Z");
    expect(addWorkingDays(friday, 1).getUTCDay()).toBe(1); // Monday
    expect(addWorkingDays(friday, 5).toISOString().slice(0, 10)).toBe("2026-10-09");
  });
});

describe("diversifyBySeller", () => {
  it("avoids the same seller twice in a row while keeping order", async () => {
    const { diversifyBySeller } = await import("@/lib/listings");
    const s = (u: string, id: number) => ({ id, seller: { username: u } });
    const out = diversifyBySeller([s("a", 1), s("a", 2), s("a", 3), s("b", 4), s("c", 5)]);
    expect(out.map((o) => o.id)).toEqual([1, 4, 2, 5, 3]);
  });
});

describe("buildSearchText", () => {
  it("lower-cases and strips accents", () => {
    expect(buildSearchText({ title: "Sézane Blouse", description: "Lovely", brand: "Sézane" })).toBe("sezane blouse sezane lovely");
  });
});

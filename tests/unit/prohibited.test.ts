import { describe, expect, it } from "vitest";
import { matchProhibited, type Term } from "@/lib/prohibited";

const terms: Term[] = [
  { term: "gun", severity: "REVIEW" },
  { term: "replica", severity: "BLOCK" },
  { term: "gift card", severity: "BLOCK" },
  { term: "1:1", severity: "BLOCK" },
  { term: "fake", severity: "REVIEW" },
];

describe("matchProhibited", () => {
  it("blocks whole words and phrases", () => {
    expect(matchProhibited("Gucci bag REPLICA great quality", terms).blocked.map((t) => t.term)).toEqual(["replica"]);
    expect(matchProhibited("Selling a £50 gift card", terms).blocked).toHaveLength(1);
    expect(matchProhibited("1:1 copy trainers", terms).blocked).toHaveLength(1);
  });
  it("matches simple plurals", () => {
    expect(matchProhibited("two replicas", terms).blocked).toHaveLength(1);
  });
  it("does not match inside other words", () => {
    expect(matchProhibited("Gunmetal grey jacket", terms).review).toHaveLength(0);
    expect(matchProhibited("Faux fur faker", terms).review).toHaveLength(0);
  });
  it("sends review terms to moderation rather than blocking", () => {
    const r = matchProhibited("Nerf gun toy", terms);
    expect(r.blocked).toHaveLength(0);
    expect(r.review.map((t) => t.term)).toEqual(["gun"]);
  });
});

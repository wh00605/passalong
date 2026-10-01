import { describe, expect, it } from "vitest";
import { containsExternalLink, looksOffPlatform } from "@/lib/fraud";

describe("off-platform payment detection", () => {
  it.each([
    "can you pay by PayPal friends and family?",
    "just do a bank transfer, sort code 12-34-56 account 12345678",
    "message me on WhatsApp",
    "text me on 07700 900123",
    "email me at someone@example.com",
    "I'll send you my Revolut",
    "pay me directly and I'll knock £5 off",
  ])("flags %s", (msg) => {
    expect(looksOffPlatform(msg)).toBe(true);
  });

  it.each(["Is this still available?", "Would you take £15?", "What are the measurements?", "Can you post it tomorrow?"])(
    "does not flag %s",
    (msg) => {
      expect(looksOffPlatform(msg)).toBe(false);
    },
  );

  it("detects external links but not our own", () => {
    expect(containsExternalLink("check https://evil.example/pay")).toBe(true);
    expect(containsExternalLink("see https://passalong.co.uk/items/1")).toBe(false);
  });
});

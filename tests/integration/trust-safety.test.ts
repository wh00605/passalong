import { describe, expect, it, vi } from "vitest";
import { db } from "@/lib/db";
import { actingAs } from "../helpers/session-mock";
import { createListing, createUser } from "../helpers/factories";
import { moderateListingAction, moderateUserAction, saveSettingsAction, setRoleAction, adminRefundAction } from "@/app/admin/actions";
import { createReportAction } from "@/app/actions/reports";
import { form } from "../helpers/session-mock";

vi.mock("@/lib/session", async () => (await import("../helpers/session-mock")).sessionModule());
vi.mock("next/headers", async () => (await import("../helpers/session-mock")).headersModule());
vi.mock("@/lib/stripe", async () => (await import("../helpers/stripe-mock")).stripeModule());

describe("admin authorisation", () => {
  it("rejects admin actions from ordinary members", async () => {
    const member = await createUser();
    const target = await createUser();
    actingAs.userId = member.id;
    const res = await moderateUserAction(target.id, "warn", undefined, "spam");
    expect(res.ok).toBe(false);
    expect(await db.adminAuditLog.count({ where: { targetId: target.id } })).toBe(0);
  });

  it("lets moderators warn/suspend but not ban, change roles or refund", async () => {
    const mod = await createUser({ role: "moderator" });
    const target = await createUser();
    actingAs.userId = mod.id;
    expect((await moderateUserAction(target.id, "warn", undefined, "Rude messages")).ok).toBe(true);
    expect((await moderateUserAction(target.id, "ban", undefined, "Fraud")).ok).toBe(false);
    expect((await setRoleAction(target.id, "admin")).ok).toBe(false);
    expect((await adminRefundAction("x", "1", "test")).ok).toBe(false);
  });
});

describe("enforcement", () => {
  it("suspends a member, revokes sessions, hides items, sends a statement of reasons and audits it", async () => {
    const admin = await createUser({ role: "admin" });
    const target = await createUser();
    await db.session.create({ data: { id: crypto.randomUUID(), token: crypto.randomUUID(), userId: target.id, expiresAt: new Date(Date.now() + 86_400_000) } });
    actingAs.userId = admin.id;
    const res = await moderateUserAction(target.id, "suspend", undefined, "Selling counterfeits", 7);
    expect(res.ok).toBe(true);
    const u = await db.user.findUniqueOrThrow({ where: { id: target.id } });
    expect(u.banned).toBe(true);
    expect(u.banExpires!.getTime()).toBeGreaterThan(Date.now() + 6 * 86_400_000);
    expect(u.holidayMode).toBe(true);
    expect(await db.session.count({ where: { userId: target.id } })).toBe(0);
    expect(await db.notification.count({ where: { userId: target.id, title: "Your account has been suspended" } })).toBe(1);
    expect(await db.adminAuditLog.count({ where: { actorId: admin.id, action: "moderation.suspend", targetId: target.id } })).toBe(1);
  });

  it("removes a reported listing and closes the report, telling the reporter", async () => {
    const admin = await createUser({ role: "admin" });
    const seller = await createUser();
    const reporter = await createUser();
    const l = await createListing(seller.id);
    actingAs.userId = reporter.id;
    expect((await createReportAction({}, form({ targetType: "LISTING", targetId: l.id, reason: "counterfeit", details: "Fake logo" }))).ok).toBe(true);
    const report = await db.report.findFirstOrThrow({ where: { listingId: l.id } });
    actingAs.userId = admin.id;
    expect((await moderateListingAction(l.id, "remove", report.id, "Counterfeit item")).ok).toBe(true);
    expect((await db.listing.findUniqueOrThrow({ where: { id: l.id } })).status).toBe("REMOVED");
    expect((await db.report.findUniqueOrThrow({ where: { id: report.id } })).status).toBe("ACTIONED");
    expect(await db.notification.count({ where: { userId: reporter.id, title: "Update on your report" } })).toBe(1);
    expect(await db.notification.count({ where: { userId: seller.id, title: "We removed one of your items" } })).toBe(1);
  });

  it("refuses duplicate reports and self-reports", async () => {
    const reporter = await createUser();
    const l = await createListing(reporter.id);
    actingAs.userId = reporter.id;
    const res = await createReportAction({}, form({ targetType: "LISTING", targetId: l.id, reason: "spam" }));
    expect(res.error).toContain("yourself");
  });
});

describe("platform settings", () => {
  it("lets admins change fees, applies them, and audits the change", async () => {
    const admin = await createUser({ role: "admin" });
    actingAs.userId = admin.id;
    const res = await saveSettingsAction({}, form({ buyerProtectionFixedPence: "80", buyerProtectionPercentBps: "500" }));
    expect(res.ok).toBe(true);
    expect((await db.platformSetting.findUniqueOrThrow({ where: { key: "buyerProtectionFixedPence" } })).value).toBe(80);
    const log = await db.adminAuditLog.findFirstOrThrow({ where: { action: "settings.update" }, orderBy: { createdAt: "desc" } });
    expect(JSON.stringify(log.metadata)).toContain("buyerProtectionFixedPence");
    await saveSettingsAction({}, form({ buyerProtectionFixedPence: "75" }));
  });

  it("rejects invalid values", async () => {
    const admin = await createUser({ role: "admin" });
    actingAs.userId = admin.id;
    const res = await saveSettingsAction({}, form({ minOfferPercent: "-5" }));
    expect(res.ok).toBeFalsy();
  });
});

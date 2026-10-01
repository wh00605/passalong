import { NextResponse, type NextRequest } from "next/server";
import { timingSafeEqual } from "node:crypto";
import { applyTrackingUpdate } from "@/lib/shipping";
import { mapShippoStatus } from "@/lib/carriers/shippo";

export const runtime = "nodejs";

function tokenOk(req: NextRequest) {
  const expected = process.env.SHIPPO_WEBHOOK_SECRET;
  const got = req.nextUrl.searchParams.get("token") ?? "";
  if (!expected) return false;
  const a = Buffer.from(expected);
  const b = Buffer.from(got);
  return a.length === b.length && timingSafeEqual(a, b);
}

/**
 * Shippo tracking webhook. Configure in Shippo as
 *   https://<domain>/api/webhooks/shippo?token=<SHIPPO_WEBHOOK_SECRET>
 * (Shippo doesn't sign webhooks, so a secret token in the URL authenticates them.)
 */
export async function POST(req: NextRequest) {
  if (!tokenOk(req)) return NextResponse.json({ error: "Unauthorised" }, { status: 401 });
  const body = (await req.json().catch(() => null)) as {
    event?: string;
    data?: { tracking_number?: string; tracking_status?: { status: string; substatus?: { code?: string } | null; status_details?: string; status_date?: string; location?: { city?: string } | null } };
  } | null;
  if (body?.event !== "track_updated" || !body.data?.tracking_number || !body.data.tracking_status) return NextResponse.json({ ignored: true });
  const ts = body.data.tracking_status;
  const result = await applyTrackingUpdate({
    trackingNumber: body.data.tracking_number,
    status: mapShippoStatus(ts.status, ts.substatus?.code),
    description: ts.status_details || ts.status,
    location: ts.location?.city ?? null,
    occurredAt: ts.status_date ? new Date(ts.status_date) : new Date(),
  });
  return NextResponse.json(result);
}

import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/session";
import { processAndStoreImage, ImageError } from "@/lib/images";
import { checkRateLimit } from "@/lib/rate-limit";
import { getConversationFor, sendMemberMessage } from "@/lib/messaging";
import { ActionError } from "@/lib/errors";

export const runtime = "nodejs";

/** Uploads a photo into a conversation (private storage) and sends it as a message. */
export async function POST(req: Request) {
  const user = await getCurrentUser();
  if (!user || !user.emailVerified || user.banned) return NextResponse.json({ error: "Please log in." }, { status: 401 });
  const form = await req.formData().catch(() => null);
  const conversationId = String(form?.get("conversationId") ?? "");
  const file = form?.get("file");
  const caption = String(form?.get("caption") ?? "").slice(0, 500);
  if (!(file instanceof File) || file.size === 0) return NextResponse.json({ error: "No photo received." }, { status: 400 });
  if (!(await getConversationFor(conversationId, user.id))) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (!(await checkRateLimit(`chat-photo:${user.id}`, 30, 3600))) return NextResponse.json({ error: "Too many photos – please wait a bit." }, { status: 429 });

  try {
    const img = await processAndStoreImage(Buffer.from(await file.arrayBuffer()), { prefix: `chat/${conversationId}`, visibility: "private" });
    const { message } = await sendMemberMessage({
      conversationId,
      senderId: user.id,
      body: caption,
      attachments: [{ storageKey: img.storageKey, width: img.width, height: img.height }],
    });
    return NextResponse.json({ id: message.id });
  } catch (err) {
    if (err instanceof ImageError || err instanceof ActionError) return NextResponse.json({ error: err.message }, { status: 400 });
    console.error("[chat-photo]", err);
    return NextResponse.json({ error: "Upload failed." }, { status: 500 });
  }
}

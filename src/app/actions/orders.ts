"use server";
import { z } from "zod";
import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { safeAction } from "@/lib/action";
import { requireUserForAction, ActionError } from "@/lib/session";
import { enforceRateLimit } from "@/lib/rate-limit";
import { cancelOrder, completeOrder } from "@/lib/orders";
import { verifyHandoverCode } from "@/lib/handover";
import { markDelivered } from "@/lib/shipping";

const id = z.string().min(1).max(40);

export async function confirmReceivedAction(orderId: string) {
  return safeAction(async () => {
    const me = await requireUserForAction();
    const order = await db.order.findFirst({ where: { id: id.parse(orderId), buyerId: me.id } });
    if (!order) throw new ActionError("Order not found.");
    if (!["SHIPPED", "DELIVERED"].includes(order.status)) throw new ActionError("You can confirm once the item has been sent.");
    await completeOrder(order.id, "buyer-confirmed");
    revalidatePath(`/orders/${order.id}`);
  });
}

export async function sellerCancelAction(orderId: string, reason: string) {
  return safeAction(async () => {
    const me = await requireUserForAction();
    const r = z.string().trim().min(3, "Tell the buyer why.").max(300).parse(reason);
    await cancelOrder({ orderId: id.parse(orderId), byUserId: me.id, reason: r });
    revalidatePath(`/orders/${orderId}`);
  });
}

/** Seller enters the buyer's 6-digit code at an in-person handover. */
export async function confirmHandoverAction(orderId: string, code: string) {
  return safeAction(async () => {
    const me = await requireUserForAction();
    await enforceRateLimit("handover", `${me.id}:${orderId}`, 8, 3600); // stops guessing the code
    const order = await db.order.findFirst({ where: { id: id.parse(orderId), sellerId: me.id, deliveryType: "IN_PERSON" } });
    if (!order) throw new ActionError("Order not found.");
    if (order.status !== "PAID") throw new ActionError("This handover has already been confirmed.");
    if (!verifyHandoverCode(order.id, code)) throw new ActionError("That code isn't right. Ask the buyer to check their order page.");
    await db.order.update({ where: { id: order.id }, data: { handoverConfirmedAt: new Date(), shippedAt: new Date() } });
    await markDelivered(order.id, "Handed over in person");
    revalidatePath(`/orders/${order.id}`);
  });
}

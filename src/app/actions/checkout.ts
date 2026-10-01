"use server";
import { z } from "zod";
import { revalidatePath } from "next/cache";
import { safeAction } from "@/lib/action";
import { requireUserForAction } from "@/lib/session";
import { enforceRateLimit } from "@/lib/rate-limit";
import { cancelOrder, preparePayment, setDelivery } from "@/lib/orders";

export async function setDeliveryAction(input: { orderId: string; deliveryType: "HOME" | "PICKUP_POINT" | "IN_PERSON"; addressId?: string }) {
  return safeAction(async () => {
    const me = await requireUserForAction();
    const d = z.object({ orderId: z.string().max(40), deliveryType: z.enum(["HOME", "PICKUP_POINT", "IN_PERSON"]), addressId: z.string().max(40).optional() }).parse(input);
    await setDelivery({ ...d, buyerId: me.id });
    revalidatePath(`/checkout/${d.orderId}`);
  });
}

export async function preparePaymentAction(orderId: string) {
  return safeAction(async () => {
    const me = await requireUserForAction();
    await enforceRateLimit("prepare-payment", me.id, 30, 600);
    return preparePayment(z.string().max(40).parse(orderId), me.id);
  });
}

export async function cancelCheckoutAction(orderId: string) {
  return safeAction(async () => {
    const me = await requireUserForAction();
    await cancelOrder({ orderId: z.string().max(40).parse(orderId), byUserId: me.id, reason: "Buyer left checkout" });
  });
}

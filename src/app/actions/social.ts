"use server";
import { z } from "zod";
import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { requireUserForAction, ActionError } from "@/lib/session";
import { safeAction } from "@/lib/action";
import { enforceRateLimit } from "@/lib/rate-limit";
import { notify } from "@/lib/notify";

const userId = z.uuid();

export async function toggleFollowAction(targetId: string) {
  return safeAction(async () => {
    const id = userId.parse(targetId);
    const me = await requireUserForAction();
    if (id === me.id) throw new ActionError("You can't follow yourself.");
    await enforceRateLimit("follow", me.id, 60, 60);

    const key = { followerId_followingId: { followerId: me.id, followingId: id } };
    const existing = await db.follow.findUnique({ where: key });
    if (existing) {
      await db.$transaction([
        db.follow.delete({ where: key }),
        db.user.update({ where: { id }, data: { followerCount: { decrement: 1 } } }),
        db.user.update({ where: { id: me.id }, data: { followingCount: { decrement: 1 } } }),
      ]);
    } else {
      const target = await db.user.findFirst({ where: { id, deletedAt: null }, select: { id: true } });
      if (!target) throw new ActionError("That member isn't available.");
      await db.$transaction([
        db.follow.create({ data: { followerId: me.id, followingId: id } }),
        db.user.update({ where: { id }, data: { followerCount: { increment: 1 } } }),
        db.user.update({ where: { id: me.id }, data: { followingCount: { increment: 1 } } }),
      ]);
      await notify({ userId: id, type: "NEW_FOLLOWER", title: `${me.name} started following you`, body: `@${me.username} is now following your wardrobe.`, url: `/members/${me.username}` });
    }
    revalidatePath("/members/[username]", "page");
    return { following: !existing };
  });
}

export async function toggleBlockAction(targetId: string) {
  return safeAction(async () => {
    const id = userId.parse(targetId);
    const me = await requireUserForAction();
    if (id === me.id) throw new ActionError("You can't block yourself.");
    const key = { blockerId_blockedId: { blockerId: me.id, blockedId: id } };
    const existing = await db.block.findUnique({ where: key });
    if (existing) {
      await db.block.delete({ where: key });
    } else {
      await db.block.create({ data: { blockerId: me.id, blockedId: id } });
      // Blocking also removes follows in both directions.
      const removed = await db.follow.deleteMany({
        where: { OR: [{ followerId: me.id, followingId: id }, { followerId: id, followingId: me.id }] },
      });
      if (removed.count) {
        for (const uid of [me.id, id]) {
          const [followers, following] = await Promise.all([
            db.follow.count({ where: { followingId: uid } }),
            db.follow.count({ where: { followerId: uid } }),
          ]);
          await db.user.update({ where: { id: uid }, data: { followerCount: followers, followingCount: following } });
        }
      }
    }
    revalidatePath("/members/[username]", "page");
    return { blocked: !existing };
  });
}

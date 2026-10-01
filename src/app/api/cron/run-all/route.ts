import { cronHandler } from "@/lib/cron";
import { autoReleaseOrders, cancelOverdueOrders } from "@/lib/orders";
import { escalateOverdueDisputes } from "@/lib/disputes";
import { autoFeedback } from "@/lib/reviews";
import { expireOffers } from "@/lib/offers";
import { expirePromotions } from "@/lib/promotions";
import { runSavedSearchAlerts } from "@/lib/alerts";
import { processDueDeletions } from "@/lib/account-deletion";

export const maxDuration = 300;

/** Runs every scheduled job. Each job is independent; one failing doesn't stop the others. */
export const GET = cronHandler(async () => {
  const jobs = {
    autoRelease: autoReleaseOrders,
    cancelOverdue: cancelOverdueOrders,
    escalateDisputes: escalateOverdueDisputes,
    autoFeedback,
    expireOffers,
    expirePromotions,
    savedSearchAlerts: runSavedSearchAlerts,
    deletions: processDueDeletions,
  };
  const results: Record<string, unknown> = {};
  for (const [name, job] of Object.entries(jobs)) {
    try {
      results[name] = await job();
    } catch (err) {
      console.error(`[cron] ${name}`, err);
      results[name] = { error: true };
    }
  }
  return results;
});

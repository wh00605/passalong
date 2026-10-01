import { cronHandler } from "@/lib/cron";
import { processDueDeletions } from "@/lib/account-deletion";

export const GET = cronHandler(() => processDueDeletions());

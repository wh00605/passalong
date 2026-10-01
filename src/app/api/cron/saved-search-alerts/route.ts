import { cronHandler } from "@/lib/cron";
import { runSavedSearchAlerts } from "@/lib/alerts";

export const GET = cronHandler(() => runSavedSearchAlerts());

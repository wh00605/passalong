import { cronHandler } from "@/lib/cron";
import { expireOffers } from "@/lib/offers";

export const GET = cronHandler(() => expireOffers());

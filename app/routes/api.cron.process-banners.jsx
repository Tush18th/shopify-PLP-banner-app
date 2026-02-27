import { json } from "@remix-run/node";
import { processScheduledBanners } from "../models/banner.server";

/**
 * Cron endpoint: activate SCHEDULED banners and expire ended ACTIVE banners.
 *
 * Call this route every 5 minutes from your scheduler:
 *   - Render cron job: GET https://YOUR-APP-DOMAIN.com/api/cron/process-banners
 *   - GitHub Actions scheduled workflow
 *   - AWS EventBridge / CloudWatch Events
 *
 * Protect with CRON_SECRET env var. Set the same value in your scheduler
 * as the Authorization header: "Bearer <CRON_SECRET>"
 */
export const loader = async ({ request }) => {
  const secret = process.env.CRON_SECRET;

  if (!secret) {
    console.error("[cron] CRON_SECRET env var is not set — endpoint is unprotected");
    return json({ error: "Cron not configured" }, { status: 500 });
  }

  const authHeader = request.headers.get("Authorization");
  if (authHeader !== `Bearer ${secret}`) {
    return json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    await processScheduledBanners();
    return json({ ok: true, ts: new Date().toISOString() });
  } catch (err) {
    console.error("[cron] processScheduledBanners failed:", err);
    return json({ error: "Internal error" }, { status: 500 });
  }
};

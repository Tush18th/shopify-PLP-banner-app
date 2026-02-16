import { json } from "@remix-run/node";
import { recordImpression, recordClick } from "../models/analytics.server";
import { checkRateLimit } from "../utils/rate-limiter.server";
import { verifyAppProxyHmac } from "../utils/hmac.server";
import prisma from "../db.server";

/**
 * Analytics tracking endpoint served via Shopify App Proxy.
 * POST /apps/plp-banners/api/storefront/track
 *
 * Requires valid Shopify App Proxy HMAC signature.
 * Body: { bannerId: number, event: "impression" | "click" }
 */
export const action = async ({ request }) => {
  if (request.method !== "POST") {
    return json({ error: "Method not allowed" }, { status: 405 });
  }

  const url = new URL(request.url);

  // ── 1. Rate limiting (stricter: 60 req/min for tracking) ──────────────
  const clientIp = request.headers.get("x-forwarded-for") || "unknown";
  const { limited } = await checkRateLimit(`track:${clientIp}`, {
    windowMs: 60_000,
    maxRequests: 60,
  });
  if (limited) {
    return json({ error: "Rate limit exceeded" }, { status: 429 });
  }

  // ── 2. Mandatory HMAC verification ────────────────────────────────────
  const { valid, shop } = verifyAppProxyHmac(url);
  if (!valid || !shop) {
    return json({ error: "Unauthorized" }, { status: 401 });
  }

  // ── 3. Parse and validate body ────────────────────────────────────────
  let body;
  try {
    body = await request.json();
  } catch {
    return json({ error: "Invalid JSON" }, { status: 400 });
  }

  const { bannerId, event } = body;

  if (!bannerId || typeof bannerId !== "number" || !Number.isInteger(bannerId) || bannerId < 1) {
    return json({ error: "Invalid bannerId" }, { status: 400 });
  }

  if (!event || !["impression", "click"].includes(event)) {
    return json({ error: "Invalid event type" }, { status: 400 });
  }

  // ── 4. Verify banner belongs to the authenticated shop ────────────────
  const shopRecord = await prisma.shop.findUnique({
    where: { domain: shop },
  });
  if (!shopRecord) {
    return json({ error: "Shop not found" }, { status: 404 });
  }

  const banner = await prisma.banner.findFirst({
    where: { id: bannerId, shopId: shopRecord.id },
  });
  if (!banner) {
    return json({ error: "Banner not found for this shop" }, { status: 404 });
  }

  // ── 5. Record the event ───────────────────────────────────────────────
  try {
    if (event === "impression") {
      await recordImpression(bannerId);
    } else {
      await recordClick(bannerId);
    }
  } catch (err) {
    console.error("Analytics tracking error:", err);
    return json({ error: "Tracking failed" }, { status: 500 });
  }

  return json({ ok: true });
};

// GET requests to the tracking endpoint are not supported
export const loader = async () => {
  return json({ error: "Method not allowed" }, { status: 405 });
};

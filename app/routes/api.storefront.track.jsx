import { json } from "@remix-run/node";
import crypto from "crypto";
import { recordImpression, recordClick } from "../models/analytics.server";
import { checkRateLimit } from "../utils/rate-limiter.server";

/**
 * Public analytics tracking endpoint.
 * POST /apps/plp-banners/api/storefront/track
 *
 * Body: { bannerId: number, event: "impression" | "click" }
 */
export const action = async ({ request }) => {
  if (request.method !== "POST") {
    return json({ error: "Method not allowed" }, { status: 405 });
  }

  // Rate limiting - stricter for tracking
  const clientIp = request.headers.get("x-forwarded-for") || "unknown";
  const { limited } = checkRateLimit(`track:${clientIp}`);
  if (limited) {
    return json({ error: "Rate limit exceeded" }, { status: 429 });
  }

  let body;
  try {
    body = await request.json();
  } catch {
    return json({ error: "Invalid JSON" }, { status: 400 });
  }

  const { bannerId, event } = body;

  // Validate inputs
  if (!bannerId || typeof bannerId !== "number" || bannerId < 1) {
    return json({ error: "Invalid bannerId" }, { status: 400 });
  }

  if (!event || !["impression", "click"].includes(event)) {
    return json({ error: "Invalid event type" }, { status: 400 });
  }

  try {
    if (event === "impression") {
      await recordImpression(bannerId);
    } else {
      await recordClick(bannerId);
    }
  } catch (err) {
    // Don't expose internal errors to storefront
    console.error("Analytics tracking error:", err);
    return json({ error: "Tracking failed" }, { status: 500 });
  }

  return json(
    { ok: true },
    {
      headers: {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Methods": "POST",
        "Access-Control-Allow-Headers": "Content-Type",
      },
    }
  );
};

// Handle CORS preflight
export const loader = async ({ request }) => {
  return new Response(null, {
    status: 204,
    headers: {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "POST, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type",
    },
  });
};

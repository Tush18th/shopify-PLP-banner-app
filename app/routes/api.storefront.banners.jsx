import { json } from "@remix-run/node";
import { getActiveBannersForStorefront } from "../models/banner.server";
import { checkRateLimit } from "../utils/rate-limiter.server";
import { verifyAppProxyHmac } from "../utils/hmac.server";

/**
 * Public storefront endpoint served via Shopify App Proxy.
 * URL: /apps/plp-banners/api/storefront/banners
 *
 * Every request MUST carry a valid Shopify App Proxy HMAC signature.
 * Requests without a signature or with an invalid signature are rejected.
 */
export const loader = async ({ request }) => {
  const url = new URL(request.url);

  // ── 1. Rate limiting ──────────────────────────────────────────────────
  const clientIp = request.headers.get("x-forwarded-for") || "unknown";
  const { limited } = await checkRateLimit(clientIp);
  if (limited) {
    return json({ error: "Rate limit exceeded" }, { status: 429 });
  }

  // ── 2. Mandatory HMAC verification ────────────────────────────────────
  const { valid, shop } = verifyAppProxyHmac(url);
  if (!valid || !shop) {
    return json({ error: "Unauthorized" }, { status: 401 });
  }

  // ── 3. Parse targeting parameters ─────────────────────────────────────
  const collectionId = url.searchParams.get("collection_id");
  const tags = url.searchParams.get("tags")?.split(",").filter(Boolean);
  const vendor = url.searchParams.get("vendor");
  const productType = url.searchParams.get("product_type");

  // ── 4. Fetch banners scoped to the verified shop ──────────────────────
  const banners = await getActiveBannersForStorefront(shop, {
    collectionId,
    tags,
    vendor,
    productType,
  });

  // ── 5. Transform for storefront consumption ───────────────────────────
  const storefrontBanners = banners.map((banner) => ({
    id: banner.id,
    title: banner.title,
    subtitle: banner.subtitle,
    desktopImageUrl: banner.desktopImageUrl,
    mobileImageUrl: banner.mobileImageUrl,
    backgroundColor: banner.backgroundColor,
    ctaText: banner.ctaText,
    ctaLink: banner.ctaLink,
    openInNewTab: banner.openInNewTab,
    tileSize: banner.tileSize,
    priority: banner.priority,
    placements: banner.placements.map((p) => ({
      type: p.placementType,
      position: p.position,
    })),
  }));

  return json(
    { banners: storefrontBanners },
    {
      headers: {
        "Cache-Control": "public, max-age=60, stale-while-revalidate=120",
      },
    }
  );
};

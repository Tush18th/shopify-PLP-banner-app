import { json } from "@remix-run/node";
import crypto from "crypto";
import { getActiveBannersForStorefront } from "../models/banner.server";
import { checkRateLimit } from "../utils/rate-limiter.server";

/**
 * Public storefront endpoint served via Shopify App Proxy.
 * URL: /apps/plp-banners/api/storefront/banners
 *
 * Shopify App Proxy adds signature verification automatically.
 * We also verify the HMAC for security.
 */
export const loader = async ({ request }) => {
  const url = new URL(request.url);

  // Rate limiting
  const clientIp = request.headers.get("x-forwarded-for") || "unknown";
  const { limited } = checkRateLimit(clientIp);
  if (limited) {
    return json({ error: "Rate limit exceeded" }, { status: 429 });
  }

  // Verify Shopify App Proxy signature
  const shop = url.searchParams.get("shop");
  const signature = url.searchParams.get("signature");

  if (!shop) {
    return json({ error: "Missing shop parameter" }, { status: 400 });
  }

  if (signature && process.env.SHOPIFY_API_SECRET) {
    const params = new URLSearchParams(url.searchParams);
    params.delete("signature");
    // Sort params for consistent signature
    const sortedParams = Array.from(params.entries())
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([key, value]) => `${key}=${value}`)
      .join("");

    const expectedSignature = crypto
      .createHmac("sha256", process.env.SHOPIFY_API_SECRET)
      .update(sortedParams)
      .digest("hex");

    if (signature !== expectedSignature) {
      return json({ error: "Invalid signature" }, { status: 401 });
    }
  }

  // Parse targeting parameters
  const collectionId = url.searchParams.get("collection_id");
  const tags = url.searchParams.get("tags")?.split(",").filter(Boolean);
  const vendor = url.searchParams.get("vendor");
  const productType = url.searchParams.get("product_type");

  const banners = await getActiveBannersForStorefront(shop, {
    collectionId,
    tags,
    vendor,
    productType,
  });

  // Transform for storefront consumption
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
        "Access-Control-Allow-Origin": "*",
      },
    }
  );
};

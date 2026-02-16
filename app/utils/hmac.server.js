import crypto from "crypto";

/**
 * Verify Shopify App Proxy HMAC signature.
 *
 * Shopify signs every App Proxy request with an HMAC-SHA256 signature
 * using the app's API secret. This function validates that signature.
 *
 * @param {URL} url - The full request URL
 * @returns {{ valid: boolean, shop: string | null }} Verification result
 */
export function verifyAppProxyHmac(url) {
  const apiSecret = process.env.SHOPIFY_API_SECRET;
  if (!apiSecret) {
    console.error("SHOPIFY_API_SECRET is not configured");
    return { valid: false, shop: null };
  }

  const signature = url.searchParams.get("signature");
  const shop = url.searchParams.get("shop");

  // Signature is mandatory for App Proxy requests
  if (!signature) {
    return { valid: false, shop: null };
  }

  // Shop parameter is mandatory
  if (!shop) {
    return { valid: false, shop: null };
  }

  // Validate shop domain format (must be *.myshopify.com)
  if (!/^[a-zA-Z0-9][a-zA-Z0-9-]*\.myshopify\.com$/.test(shop)) {
    return { valid: false, shop: null };
  }

  // Rebuild the query string without the signature, sorted alphabetically
  const params = new URLSearchParams(url.searchParams);
  params.delete("signature");

  const sortedInput = Array.from(params.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([key, value]) => `${key}=${value}`)
    .join("");

  const expectedSignature = crypto
    .createHmac("sha256", apiSecret)
    .update(sortedInput)
    .digest("hex");

  // Constant-time comparison to prevent timing attacks
  const valid =
    signature.length === expectedSignature.length &&
    crypto.timingSafeEqual(
      Buffer.from(signature, "utf8"),
      Buffer.from(expectedSignature, "utf8")
    );

  return { valid, shop: valid ? shop : null };
}

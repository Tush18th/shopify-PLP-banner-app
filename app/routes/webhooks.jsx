import { authenticate } from "../shopify.server";
import prisma from "../db.server";

export const action = async ({ request }) => {
  const { topic, shop, session, admin, payload } =
    await authenticate.webhook(request);

  if (!admin && topic !== "SHOP_REDACT") {
    // The admin context isn't returned if the webhook fired after a shop was uninstalled.
    throw new Response();
  }

  switch (topic) {
    case "APP_UNINSTALLED":
      if (session) {
        // Clean up session data
        await prisma.session.deleteMany({ where: { shop } });
      }
      break;

    case "SHOP_UPDATE":
      // Update shop details if they change
      if (payload) {
        await prisma.shop.updateMany({
          where: { domain: shop },
          data: {
            name: payload.name || shop,
            timezone: payload.iana_timezone || "UTC",
            currency: payload.currency || "USD",
          },
        });
      }
      break;

    case "CUSTOMERS_DATA_REQUEST":
      // This app doesn't store customer data, respond with empty
      break;

    case "CUSTOMERS_REDACT":
      // This app doesn't store customer data, nothing to redact
      break;

    case "SHOP_REDACT":
      // Delete all shop-related data
      const shopRecord = await prisma.shop.findUnique({
        where: { domain: shop },
      });
      if (shopRecord) {
        await prisma.shop.delete({ where: { id: shopRecord.id } });
      }
      break;

    default:
      throw new Response("Unhandled webhook topic", { status: 404 });
  }

  throw new Response();
};

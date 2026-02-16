import { authenticate } from "../shopify.server";
import prisma from "../db.server";

export const action = async ({ request }) => {
  const { topic, shop, session, admin, payload } =
    await authenticate.webhook(request);

  // For GDPR compliance webhooks, admin context is not available.
  // Only require admin for non-GDPR topics.
  const gdprTopics = ["CUSTOMERS_DATA_REQUEST", "CUSTOMERS_REDACT", "SHOP_REDACT"];
  if (!admin && !gdprTopics.includes(topic)) {
    throw new Response();
  }

  switch (topic) {
    case "APP_UNINSTALLED": {
      console.log(`[webhook] APP_UNINSTALLED for ${shop}`);
      // Clean up sessions
      await prisma.session.deleteMany({ where: { shop } });
      break;
    }

    case "SHOP_UPDATE": {
      console.log(`[webhook] SHOP_UPDATE for ${shop}`);
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
    }

    case "CUSTOMERS_DATA_REQUEST": {
      // GDPR: Merchant requested customer data export.
      // This app does not store any customer personal data.
      console.log(
        `[webhook] CUSTOMERS_DATA_REQUEST for ${shop}` +
        (payload?.customer?.id ? `, customer: ${payload.customer.id}` : "")
      );
      break;
    }

    case "CUSTOMERS_REDACT": {
      // GDPR: Merchant requested deletion of customer data.
      // This app does not store any customer personal data.
      console.log(
        `[webhook] CUSTOMERS_REDACT for ${shop}` +
        (payload?.customer?.id ? `, customer: ${payload.customer.id}` : "")
      );
      break;
    }

    case "SHOP_REDACT": {
      // GDPR: Shopify requests full deletion of shop data (48h after uninstall).
      console.log(`[webhook] SHOP_REDACT for ${shop}`);

      const shopRecord = await prisma.shop.findUnique({
        where: { domain: shop },
      });

      if (shopRecord) {
        // Cascade delete removes all banners, placements,
        // targeting rules, and analytics associated with this shop.
        await prisma.shop.delete({ where: { id: shopRecord.id } });
        console.log(`[webhook] SHOP_REDACT: deleted all data for ${shop}`);
      }

      // Also clean up any remaining sessions
      await prisma.session.deleteMany({ where: { shop } });
      break;
    }

    default:
      throw new Response("Unhandled webhook topic", { status: 404 });
  }

  // Return 200 OK for all handled topics
  return new Response(null, { status: 200 });
};

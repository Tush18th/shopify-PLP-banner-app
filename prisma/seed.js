import { PrismaClient } from "@prisma/client";

if (process.env.NODE_ENV === "production") {
  console.error(
    "ERROR: Seed script must not be run in production. " +
    "This would overwrite real data with development fixtures. Aborting."
  );
  process.exit(1);
}

const prisma = new PrismaClient();

async function main() {
  console.log("Seeding database...");

  // Create a demo shop (for development only)
  const shop = await prisma.shop.upsert({
    where: { domain: "dev-store.myshopify.com" },
    update: {},
    create: {
      domain: "dev-store.myshopify.com",
      name: "Dev Store",
      timezone: "UTC",
    },
  });

  // Create sample banners
  const banner1 = await prisma.banner.create({
    data: {
      shopId: shop.id,
      name: "Summer Sale Banner",
      status: "ACTIVE",
      priority: 10,
      title: "Summer Sale",
      subtitle: "Up to 50% off selected items",
      backgroundColor: "#FF6B35",
      ctaText: "Shop Now",
      ctaLink: "/collections/summer-sale",
      openInNewTab: false,
      tileSize: "SIZE_1x1",
      placements: {
        create: [
          { placementType: "AFTER_INDEX", position: 3 },
          { placementType: "AFTER_INDEX", position: 9 },
        ],
      },
    },
  });

  const banner2 = await prisma.banner.create({
    data: {
      shopId: shop.id,
      name: "New Arrivals Wide Banner",
      status: "ACTIVE",
      priority: 5,
      title: "New Arrivals",
      subtitle: "Check out our latest collection",
      backgroundColor: "#1A1A2E",
      ctaText: "Explore",
      ctaLink: "/collections/new-arrivals",
      openInNewTab: false,
      tileSize: "SIZE_2x1",
      placements: {
        create: [{ placementType: "AFTER_ROW", position: 2 }],
      },
      targetingRules: {
        create: [
          { targetType: "COLLECTION", value: "all" },
        ],
      },
    },
  });

  console.log("Seeded:", { banner1: banner1.id, banner2: banner2.id });
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

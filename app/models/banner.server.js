import prisma from "../db.server";

/**
 * List all banners for a shop with optional filters.
 */
export async function listBanners(shopId, { status, search, page = 1, limit = 25 } = {}) {
  const where = { shopId };

  if (status && status !== "ALL") {
    where.status = status;
  }
  if (search) {
    where.name = { contains: search, mode: "insensitive" };
  }

  const [banners, total] = await Promise.all([
    prisma.banner.findMany({
      where,
      include: {
        placements: true,
        targetingRules: true,
        _count: { select: { analytics: true } },
      },
      orderBy: [{ priority: "desc" }, { createdAt: "desc" }],
      skip: (page - 1) * limit,
      take: limit,
    }),
    prisma.banner.count({ where }),
  ]);

  return { banners, total, page, limit, totalPages: Math.ceil(total / limit) };
}

/**
 * Get a single banner with all relations.
 */
export async function getBanner(id, shopId) {
  return prisma.banner.findFirst({
    where: { id, shopId },
    include: {
      placements: true,
      targetingRules: true,
    },
  });
}

/**
 * Create a new banner with placements and targeting rules.
 */
export async function createBanner(shopId, data) {
  const { placements, targetingRules, ...bannerData } = data;

  return prisma.banner.create({
    data: {
      ...bannerData,
      shopId,
      placements: placements?.length
        ? { create: placements }
        : undefined,
      targetingRules: targetingRules?.length
        ? { create: targetingRules }
        : undefined,
    },
    include: {
      placements: true,
      targetingRules: true,
    },
  });
}

/**
 * Update an existing banner. Replaces placements and targeting rules.
 */
export async function updateBanner(id, shopId, data) {
  const { placements, targetingRules, ...bannerData } = data;

  // Use a transaction to replace related data atomically
  return prisma.$transaction(async (tx) => {
    // Delete old placements and targeting rules
    await tx.bannerPlacement.deleteMany({ where: { bannerId: id } });
    await tx.bannerTargetingRule.deleteMany({ where: { bannerId: id } });

    // Update banner with new data
    return tx.banner.update({
      where: { id },
      data: {
        ...bannerData,
        placements: placements?.length
          ? { create: placements }
          : undefined,
        targetingRules: targetingRules?.length
          ? { create: targetingRules }
          : undefined,
      },
      include: {
        placements: true,
        targetingRules: true,
      },
    });
  });
}

/**
 * Delete a banner.
 */
export async function deleteBanner(id, shopId) {
  // Verify ownership first
  const banner = await prisma.banner.findFirst({ where: { id, shopId } });
  if (!banner) {
    throw new Error("Banner not found");
  }
  return prisma.banner.delete({ where: { id } });
}

/**
 * Duplicate a banner (creates a copy in DRAFT status).
 */
export async function duplicateBanner(id, shopId) {
  const original = await getBanner(id, shopId);
  if (!original) {
    throw new Error("Banner not found");
  }

  const {
    id: _id,
    shopId: _shopId,
    createdAt: _created,
    updatedAt: _updated,
    placements,
    targetingRules,
    ...bannerData
  } = original;

  return createBanner(shopId, {
    ...bannerData,
    name: `${bannerData.name} (Copy)`,
    status: "DRAFT",
    placements: placements.map(({ placementType, position }) => ({
      placementType,
      position,
    })),
    targetingRules: targetingRules.map(({ targetType, value }) => ({
      targetType,
      value,
    })),
  });
}

/**
 * Update banner status.
 */
export async function updateBannerStatus(id, shopId, status) {
  const banner = await prisma.banner.findFirst({ where: { id, shopId } });
  if (!banner) {
    throw new Error("Banner not found");
  }
  return prisma.banner.update({
    where: { id },
    data: { status },
  });
}

/**
 * Run scheduled status updates:
 * - SCHEDULED banners whose startDate has passed -> ACTIVE
 * - ACTIVE banners whose endDate has passed -> EXPIRED
 */
export async function processScheduledBanners() {
  const now = new Date();

  // Activate scheduled banners that should start
  await prisma.banner.updateMany({
    where: {
      status: "SCHEDULED",
      startDate: { lte: now },
      OR: [
        { endDate: null },
        { endDate: { gt: now } },
      ],
    },
    data: { status: "ACTIVE" },
  });

  // Expire active banners that have ended
  await prisma.banner.updateMany({
    where: {
      status: "ACTIVE",
      endDate: { lte: now },
    },
    data: { status: "EXPIRED" },
  });
}

/**
 * Get active banners for storefront rendering.
 * Filters by shop, active status, and optional targeting.
 */
export async function getActiveBannersForStorefront(shopDomain, { collectionId, tags, vendor, productType } = {}) {
  const shop = await prisma.shop.findUnique({ where: { domain: shopDomain } });
  if (!shop) return [];

  const now = new Date();

  const banners = await prisma.banner.findMany({
    where: {
      shopId: shop.id,
      status: "ACTIVE",
      OR: [
        { startDate: null },
        { startDate: { lte: now } },
      ],
      AND: [
        {
          OR: [
            { endDate: null },
            { endDate: { gt: now } },
          ],
        },
      ],
    },
    include: {
      placements: true,
      targetingRules: true,
    },
    orderBy: { priority: "desc" },
  });

  // Filter by targeting rules
  return banners.filter((banner) => {
    // If no targeting rules, show everywhere
    if (banner.targetingRules.length === 0) return true;

    // Check if any targeting rule matches
    return banner.targetingRules.some((rule) => {
      switch (rule.targetType) {
        case "COLLECTION":
          return collectionId && rule.value === String(collectionId);
        case "TAG":
          return tags && tags.some((t) => t.toLowerCase() === rule.value.toLowerCase());
        case "VENDOR":
          return vendor && vendor.toLowerCase() === rule.value.toLowerCase();
        case "PRODUCT_TYPE":
          return productType && productType.toLowerCase() === rule.value.toLowerCase();
        default:
          return false;
      }
    });
  });
}

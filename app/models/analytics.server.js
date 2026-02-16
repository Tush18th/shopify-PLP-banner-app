import prisma from "../db.server";

/**
 * Record an impression for a banner.
 */
export async function recordImpression(bannerId) {
  const today = getToday();

  await prisma.bannerAnalyticsDaily.upsert({
    where: {
      bannerId_date: { bannerId, date: today },
    },
    update: {
      impressions: { increment: 1 },
    },
    create: {
      bannerId,
      date: today,
      impressions: 1,
      clicks: 0,
    },
  });
}

/**
 * Record a click for a banner.
 */
export async function recordClick(bannerId) {
  const today = getToday();

  await prisma.bannerAnalyticsDaily.upsert({
    where: {
      bannerId_date: { bannerId, date: today },
    },
    update: {
      clicks: { increment: 1 },
    },
    create: {
      bannerId,
      date: today,
      impressions: 0,
      clicks: 1,
    },
  });
}

/**
 * Get analytics for a specific banner within a date range.
 */
export async function getBannerAnalytics(bannerId, startDate, endDate) {
  const analytics = await prisma.bannerAnalyticsDaily.findMany({
    where: {
      bannerId,
      date: {
        gte: startDate,
        lte: endDate,
      },
    },
    orderBy: { date: "asc" },
  });

  const totals = analytics.reduce(
    (acc, day) => ({
      impressions: acc.impressions + day.impressions,
      clicks: acc.clicks + day.clicks,
    }),
    { impressions: 0, clicks: 0 }
  );

  return {
    daily: analytics,
    totals: {
      ...totals,
      ctr: totals.impressions > 0
        ? ((totals.clicks / totals.impressions) * 100).toFixed(2)
        : "0.00",
    },
  };
}

/**
 * Get shop-wide analytics dashboard data.
 */
export async function getShopAnalytics(shopId, startDate, endDate) {
  // Get all banner IDs for the shop
  const banners = await prisma.banner.findMany({
    where: { shopId },
    select: { id: true, name: true, status: true },
  });
  const bannerIds = banners.map((b) => b.id);

  if (bannerIds.length === 0) {
    return {
      totalBanners: 0,
      activeBanners: 0,
      totalImpressions: 0,
      totalClicks: 0,
      ctr: "0.00",
      perBanner: [],
    };
  }

  // Aggregate analytics
  const analytics = await prisma.bannerAnalyticsDaily.groupBy({
    by: ["bannerId"],
    where: {
      bannerId: { in: bannerIds },
      date: {
        gte: startDate,
        lte: endDate,
      },
    },
    _sum: {
      impressions: true,
      clicks: true,
    },
  });

  const totalImpressions = analytics.reduce((sum, a) => sum + (a._sum.impressions || 0), 0);
  const totalClicks = analytics.reduce((sum, a) => sum + (a._sum.clicks || 0), 0);

  const perBanner = banners.map((banner) => {
    const bannerAnalytics = analytics.find((a) => a.bannerId === banner.id);
    const impressions = bannerAnalytics?._sum.impressions || 0;
    const clicks = bannerAnalytics?._sum.clicks || 0;
    return {
      id: banner.id,
      name: banner.name,
      status: banner.status,
      impressions,
      clicks,
      ctr: impressions > 0 ? ((clicks / impressions) * 100).toFixed(2) : "0.00",
    };
  });

  return {
    totalBanners: banners.length,
    activeBanners: banners.filter((b) => b.status === "ACTIVE").length,
    totalImpressions,
    totalClicks,
    ctr: totalImpressions > 0
      ? ((totalClicks / totalImpressions) * 100).toFixed(2)
      : "0.00",
    perBanner: perBanner.sort((a, b) => b.impressions - a.impressions),
  };
}

/**
 * Get analytics for CSV export.
 */
export async function getAnalyticsForExport(shopId, startDate, endDate) {
  const banners = await prisma.banner.findMany({
    where: { shopId },
    select: { id: true, name: true },
  });
  const bannerIds = banners.map((b) => b.id);

  const analytics = await prisma.bannerAnalyticsDaily.findMany({
    where: {
      bannerId: { in: bannerIds },
      date: {
        gte: startDate,
        lte: endDate,
      },
    },
    include: {
      banner: { select: { name: true } },
    },
    orderBy: [{ date: "asc" }, { bannerId: "asc" }],
  });

  return analytics.map((row) => ({
    date: row.date.toISOString().split("T")[0],
    bannerName: row.banner.name,
    impressions: row.impressions,
    clicks: row.clicks,
    ctr: row.impressions > 0
      ? ((row.clicks / row.impressions) * 100).toFixed(2) + "%"
      : "0.00%",
  }));
}

function getToday() {
  const now = new Date();
  return new Date(now.getFullYear(), now.getMonth(), now.getDate());
}

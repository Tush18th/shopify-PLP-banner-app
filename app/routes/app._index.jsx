import { json } from "@remix-run/node";
import { useLoaderData, useNavigate } from "@remix-run/react";
import {
  Page,
  Layout,
  Card,
  BlockStack,
  InlineStack,
  Text,
  Box,
  Divider,
  Button,
  Banner,
  Icon,
} from "@shopify/polaris";
import { authenticate } from "../shopify.server";
import { getShop } from "../models/shop.server";
import { getShopAnalytics } from "../models/analytics.server";
import prisma from "../db.server";

export const loader = async ({ request }) => {
  const { session } = await authenticate.admin(request);
  const shop = await getShop(session.shop);

  // Date range: last 30 days
  const endDate = new Date();
  const startDate = new Date();
  startDate.setDate(startDate.getDate() - 30);

  const analytics = await getShopAnalytics(shop.id, startDate, endDate);

  // Get recent banners
  const recentBanners = await prisma.banner.findMany({
    where: { shopId: shop.id },
    orderBy: { updatedAt: "desc" },
    take: 5,
    select: { id: true, name: true, status: true, updatedAt: true },
  });

  return json({ shop, analytics, recentBanners });
};

export default function Dashboard() {
  const { analytics, recentBanners } = useLoaderData();
  const navigate = useNavigate();

  const statCards = [
    { label: "Total Banners", value: analytics.totalBanners },
    { label: "Active Banners", value: analytics.activeBanners },
    { label: "Impressions (30d)", value: analytics.totalImpressions.toLocaleString() },
    { label: "Clicks (30d)", value: analytics.totalClicks.toLocaleString() },
    { label: "CTR (30d)", value: `${analytics.ctr}%` },
  ];

  return (
    <Page title="Dashboard">
      <BlockStack gap="500">
        <Layout>
          {statCards.map((stat) => (
            <Layout.Section key={stat.label} variant="oneThird">
              <Card>
                <BlockStack gap="200">
                  <Text as="p" variant="bodyMd" tone="subdued">
                    {stat.label}
                  </Text>
                  <Text as="p" variant="headingXl">
                    {stat.value}
                  </Text>
                </BlockStack>
              </Card>
            </Layout.Section>
          ))}
        </Layout>

        <Layout>
          <Layout.Section>
            <Card>
              <BlockStack gap="400">
                <InlineStack align="space-between">
                  <Text as="h2" variant="headingMd">
                    Top Performing Banners (30 days)
                  </Text>
                  <Button variant="plain" onClick={() => navigate("/app/reports")}>
                    View all reports
                  </Button>
                </InlineStack>
                <Divider />
                {analytics.perBanner.length === 0 ? (
                  <Text as="p" tone="subdued">
                    No banner analytics data yet. Create and activate banners to start tracking.
                  </Text>
                ) : (
                  <BlockStack gap="300">
                    {analytics.perBanner.slice(0, 5).map((banner) => (
                      <InlineStack key={banner.id} align="space-between" blockAlign="center">
                        <Box>
                          <Text as="span" variant="bodyMd" fontWeight="semibold">
                            {banner.name}
                          </Text>
                        </Box>
                        <InlineStack gap="400">
                          <Text as="span" variant="bodyMd" tone="subdued">
                            {banner.impressions.toLocaleString()} imp
                          </Text>
                          <Text as="span" variant="bodyMd" tone="subdued">
                            {banner.clicks.toLocaleString()} clicks
                          </Text>
                          <Text as="span" variant="bodyMd" fontWeight="semibold">
                            {banner.ctr}% CTR
                          </Text>
                        </InlineStack>
                      </InlineStack>
                    ))}
                  </BlockStack>
                )}
              </BlockStack>
            </Card>
          </Layout.Section>

          <Layout.Section variant="oneThird">
            <Card>
              <BlockStack gap="400">
                <Text as="h2" variant="headingMd">
                  Recent Banners
                </Text>
                <Divider />
                {recentBanners.length === 0 ? (
                  <BlockStack gap="300">
                    <Text as="p" tone="subdued">
                      No banners yet.
                    </Text>
                    <Button variant="primary" onClick={() => navigate("/app/banners/new")}>
                      Create your first banner
                    </Button>
                  </BlockStack>
                ) : (
                  <BlockStack gap="200">
                    {recentBanners.map((banner) => (
                      <Button
                        key={banner.id}
                        variant="plain"
                        onClick={() => navigate(`/app/banners/${banner.id}`)}
                        textAlign="start"
                      >
                        <InlineStack gap="200" blockAlign="center">
                          <StatusDot status={banner.status} />
                          <Text as="span">{banner.name}</Text>
                        </InlineStack>
                      </Button>
                    ))}
                  </BlockStack>
                )}
              </BlockStack>
            </Card>
          </Layout.Section>
        </Layout>

        <Banner
          title="Setup Guide"
          tone="info"
          action={{ content: "View Banners", onAction: () => navigate("/app/banners") }}
        >
          <p>
            Create promotional banners and they will automatically appear in your collection pages.
            Make sure to enable the app embed in your theme customizer.
          </p>
        </Banner>
      </BlockStack>
    </Page>
  );
}

function StatusDot({ status }) {
  const colors = {
    DRAFT: "rgba(140, 145, 150, 1)",
    ACTIVE: "rgba(0, 128, 96, 1)",
    SCHEDULED: "rgba(0, 111, 187, 1)",
    PAUSED: "rgba(191, 135, 0, 1)",
    EXPIRED: "rgba(186, 49, 54, 1)",
  };
  return (
    <span
      style={{
        display: "inline-block",
        width: 8,
        height: 8,
        borderRadius: "50%",
        backgroundColor: colors[status] || colors.DRAFT,
      }}
    />
  );
}

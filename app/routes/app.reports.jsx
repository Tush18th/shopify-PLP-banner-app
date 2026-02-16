import { json } from "@remix-run/node";
import { useLoaderData, useSearchParams, useSubmit } from "@remix-run/react";
import {
  Page,
  Layout,
  Card,
  BlockStack,
  InlineStack,
  Text,
  DataTable,
  Select,
  Button,
  Box,
  Badge,
  Divider,
} from "@shopify/polaris";
import { useState, useCallback } from "react";
import { authenticate } from "../shopify.server";
import { getShop } from "../models/shop.server";
import { getShopAnalytics, getAnalyticsForExport } from "../models/analytics.server";

export const loader = async ({ request }) => {
  const { session } = await authenticate.admin(request);
  const shop = await getShop(session.shop);

  const url = new URL(request.url);
  const range = url.searchParams.get("range") || "30";
  const exportFormat = url.searchParams.get("export");

  const endDate = new Date();
  const startDate = new Date();
  startDate.setDate(startDate.getDate() - parseInt(range, 10));

  // Handle CSV export
  if (exportFormat === "csv") {
    const exportData = await getAnalyticsForExport(shop.id, startDate, endDate);

    const headers = ["Date", "Banner Name", "Impressions", "Clicks", "CTR"];
    const csvRows = [
      headers.join(","),
      ...exportData.map((row) =>
        [row.date, `"${row.bannerName}"`, row.impressions, row.clicks, row.ctr].join(",")
      ),
    ];
    const csvContent = csvRows.join("\n");

    return new Response(csvContent, {
      headers: {
        "Content-Type": "text/csv",
        "Content-Disposition": `attachment; filename="banner-analytics-${range}d.csv"`,
      },
    });
  }

  const analytics = await getShopAnalytics(shop.id, startDate, endDate);

  return json({ analytics, range });
};

const RANGE_OPTIONS = [
  { label: "Last 7 days", value: "7" },
  { label: "Last 14 days", value: "14" },
  { label: "Last 30 days", value: "30" },
  { label: "Last 60 days", value: "60" },
  { label: "Last 90 days", value: "90" },
];

export default function Reports() {
  const { analytics, range } = useLoaderData();
  const [searchParams, setSearchParams] = useSearchParams();

  const handleRangeChange = useCallback(
    (value) => {
      const params = new URLSearchParams(searchParams);
      params.set("range", value);
      params.delete("export");
      setSearchParams(params);
    },
    [searchParams, setSearchParams]
  );

  const handleExport = () => {
    const params = new URLSearchParams(searchParams);
    params.set("export", "csv");
    params.set("range", range);
    window.open(`?${params.toString()}`, "_blank");
  };

  const tableRows = analytics.perBanner.map((banner) => [
    banner.name,
    <Badge
      key={banner.id}
      tone={banner.status === "ACTIVE" ? "success" : undefined}
    >
      {banner.status}
    </Badge>,
    banner.impressions.toLocaleString(),
    banner.clicks.toLocaleString(),
    `${banner.ctr}%`,
  ]);

  return (
    <Page title="Analytics Reports">
      <BlockStack gap="500">
        {/* Controls */}
        <Card>
          <InlineStack align="space-between" blockAlign="center">
            <InlineStack gap="400" blockAlign="center">
              <Select
                label="Date range"
                labelInline
                options={RANGE_OPTIONS}
                value={range}
                onChange={handleRangeChange}
              />
            </InlineStack>
            <Button onClick={handleExport}>
              Export CSV
            </Button>
          </InlineStack>
        </Card>

        {/* Summary Cards */}
        <Layout>
          <Layout.Section variant="oneThird">
            <Card>
              <BlockStack gap="200">
                <Text as="p" variant="bodyMd" tone="subdued">Total Impressions</Text>
                <Text as="p" variant="headingXl">
                  {analytics.totalImpressions.toLocaleString()}
                </Text>
              </BlockStack>
            </Card>
          </Layout.Section>
          <Layout.Section variant="oneThird">
            <Card>
              <BlockStack gap="200">
                <Text as="p" variant="bodyMd" tone="subdued">Total Clicks</Text>
                <Text as="p" variant="headingXl">
                  {analytics.totalClicks.toLocaleString()}
                </Text>
              </BlockStack>
            </Card>
          </Layout.Section>
          <Layout.Section variant="oneThird">
            <Card>
              <BlockStack gap="200">
                <Text as="p" variant="bodyMd" tone="subdued">Overall CTR</Text>
                <Text as="p" variant="headingXl">
                  {analytics.ctr}%
                </Text>
              </BlockStack>
            </Card>
          </Layout.Section>
        </Layout>

        {/* Per-banner table */}
        <Card>
          <BlockStack gap="400">
            <Text as="h2" variant="headingMd">Per-Banner Performance</Text>
            <Divider />
            {tableRows.length === 0 ? (
              <Text as="p" tone="subdued">
                No banner analytics data available for this period.
              </Text>
            ) : (
              <DataTable
                columnContentTypes={["text", "text", "numeric", "numeric", "numeric"]}
                headings={["Banner", "Status", "Impressions", "Clicks", "CTR"]}
                rows={tableRows}
                totals={[
                  "",
                  "",
                  analytics.totalImpressions.toLocaleString(),
                  analytics.totalClicks.toLocaleString(),
                  `${analytics.ctr}%`,
                ]}
                showTotalsInFooter
                sortable={[true, false, true, true, true]}
              />
            )}
          </BlockStack>
        </Card>
      </BlockStack>
    </Page>
  );
}

import { json } from "@remix-run/node";
import {
  useLoaderData,
  useNavigate,
  useSearchParams,
  useSubmit,
} from "@remix-run/react";
import {
  Page,
  Card,
  IndexTable,
  Badge,
  Text,
  InlineStack,
  Filters,
  ChoiceList,
  Button,
  EmptyState,
  Pagination,
  Thumbnail,
  BlockStack,
} from "@shopify/polaris";
import { authenticate } from "../shopify.server";
import { getShop } from "../models/shop.server";
import { listBanners, deleteBanner, updateBannerStatus, duplicateBanner } from "../models/banner.server";

export const loader = async ({ request }) => {
  const { session } = await authenticate.admin(request);
  const shop = await getShop(session.shop);

  const url = new URL(request.url);
  const status = url.searchParams.get("status") || "ALL";
  const search = url.searchParams.get("search") || "";
  const page = parseInt(url.searchParams.get("page") || "1", 10);

  const result = await listBanners(shop.id, { status, search, page });

  return json({ ...result, status, search });
};

export const action = async ({ request }) => {
  const { session } = await authenticate.admin(request);
  const shop = await getShop(session.shop);
  const formData = await request.formData();
  const intent = formData.get("intent");
  const bannerId = parseInt(formData.get("bannerId"), 10);

  switch (intent) {
    case "delete":
      await deleteBanner(bannerId, shop.id);
      return json({ ok: true });
    case "pause":
      await updateBannerStatus(bannerId, shop.id, "PAUSED");
      return json({ ok: true });
    case "activate":
      await updateBannerStatus(bannerId, shop.id, "ACTIVE");
      return json({ ok: true });
    case "duplicate":
      await duplicateBanner(bannerId, shop.id);
      return json({ ok: true });
    default:
      return json({ error: "Unknown action" }, { status: 400 });
  }
};

const STATUS_BADGES = {
  DRAFT: { tone: undefined, label: "Draft" },
  ACTIVE: { tone: "success", label: "Active" },
  SCHEDULED: { tone: "info", label: "Scheduled" },
  PAUSED: { tone: "warning", label: "Paused" },
  EXPIRED: { tone: "critical", label: "Expired" },
};

export default function BannersList() {
  const { banners, total, page, totalPages, status, search } = useLoaderData();
  const navigate = useNavigate();
  const submit = useSubmit();
  const [searchParams, setSearchParams] = useSearchParams();

  const handleAction = (intent, bannerId) => {
    if (intent === "delete" && !confirm("Are you sure you want to delete this banner?")) {
      return;
    }
    const formData = new FormData();
    formData.set("intent", intent);
    formData.set("bannerId", String(bannerId));
    submit(formData, { method: "post" });
  };

  const handleFilterChange = (key, value) => {
    const params = new URLSearchParams(searchParams);
    if (value) {
      params.set(key, value);
    } else {
      params.delete(key);
    }
    params.set("page", "1");
    setSearchParams(params);
  };

  const resourceName = { singular: "banner", plural: "banners" };

  const rowMarkup = banners.map((banner, index) => {
    const badgeInfo = STATUS_BADGES[banner.status] || STATUS_BADGES.DRAFT;
    return (
      <IndexTable.Row
        id={String(banner.id)}
        key={banner.id}
        position={index}
        onClick={() => navigate(`/app/banners/${banner.id}`)}
      >
        <IndexTable.Cell>
          {banner.desktopImageUrl ? (
            <Thumbnail source={banner.desktopImageUrl} alt={banner.name} size="small" />
          ) : (
            <div
              style={{
                width: 40,
                height: 40,
                backgroundColor: banner.backgroundColor,
                borderRadius: 4,
                border: "1px solid #e1e3e5",
              }}
            />
          )}
        </IndexTable.Cell>
        <IndexTable.Cell>
          <Text variant="bodyMd" fontWeight="bold">
            {banner.name}
          </Text>
        </IndexTable.Cell>
        <IndexTable.Cell>
          <Badge tone={badgeInfo.tone}>{badgeInfo.label}</Badge>
        </IndexTable.Cell>
        <IndexTable.Cell>
          <Text as="span" variant="bodyMd" tone="subdued">
            {banner.tileSize.replace("SIZE_", "")}
          </Text>
        </IndexTable.Cell>
        <IndexTable.Cell>
          <Text as="span" variant="bodyMd" tone="subdued">
            {banner.priority}
          </Text>
        </IndexTable.Cell>
        <IndexTable.Cell>
          <Text as="span" variant="bodyMd" tone="subdued">
            {banner.placements.length} placement{banner.placements.length !== 1 ? "s" : ""}
          </Text>
        </IndexTable.Cell>
        <IndexTable.Cell>
          <InlineStack gap="200">
            {banner.status === "ACTIVE" ? (
              <Button size="slim" onClick={(e) => { e.stopPropagation(); handleAction("pause", banner.id); }}>
                Pause
              </Button>
            ) : banner.status !== "EXPIRED" ? (
              <Button size="slim" onClick={(e) => { e.stopPropagation(); handleAction("activate", banner.id); }}>
                Activate
              </Button>
            ) : null}
            <Button
              size="slim"
              variant="plain"
              onClick={(e) => { e.stopPropagation(); handleAction("duplicate", banner.id); }}
            >
              Duplicate
            </Button>
            <Button
              size="slim"
              variant="plain"
              tone="critical"
              onClick={(e) => { e.stopPropagation(); handleAction("delete", banner.id); }}
            >
              Delete
            </Button>
          </InlineStack>
        </IndexTable.Cell>
      </IndexTable.Row>
    );
  });

  const emptyState = (
    <EmptyState
      heading="Create your first promotional banner"
      action={{ content: "Create banner", onAction: () => navigate("/app/banners/new") }}
      image="https://cdn.shopify.com/s/files/1/0262/4071/2726/files/emptystate-files.png"
    >
      <p>Promotional banners appear inside your collection product grids to drive engagement.</p>
    </EmptyState>
  );

  return (
    <Page
      title="Banners"
      primaryAction={{
        content: "Create banner",
        onAction: () => navigate("/app/banners/new"),
      }}
    >
      <Card padding="0">
        <div style={{ padding: "16px" }}>
          <Filters
            queryValue={search}
            queryPlaceholder="Search banners..."
            onQueryChange={(value) => handleFilterChange("search", value)}
            onQueryClear={() => handleFilterChange("search", "")}
            filters={[
              {
                key: "status",
                label: "Status",
                filter: (
                  <ChoiceList
                    title="Status"
                    titleHidden
                    choices={[
                      { label: "All", value: "ALL" },
                      { label: "Active", value: "ACTIVE" },
                      { label: "Draft", value: "DRAFT" },
                      { label: "Scheduled", value: "SCHEDULED" },
                      { label: "Paused", value: "PAUSED" },
                      { label: "Expired", value: "EXPIRED" },
                    ]}
                    selected={[status]}
                    onChange={([val]) => handleFilterChange("status", val)}
                  />
                ),
                shortcut: true,
              },
            ]}
            onClearAll={() => {
              setSearchParams({});
            }}
          />
        </div>

        <IndexTable
          resourceName={resourceName}
          itemCount={banners.length}
          emptyState={emptyState}
          headings={[
            { title: "" },
            { title: "Name" },
            { title: "Status" },
            { title: "Size" },
            { title: "Priority" },
            { title: "Placements" },
            { title: "Actions" },
          ]}
          selectable={false}
        >
          {rowMarkup}
        </IndexTable>

        {totalPages > 1 && (
          <div style={{ padding: "16px", display: "flex", justifyContent: "center" }}>
            <Pagination
              hasPrevious={page > 1}
              hasNext={page < totalPages}
              onPrevious={() => handleFilterChange("page", String(page - 1))}
              onNext={() => handleFilterChange("page", String(page + 1))}
            />
          </div>
        )}
      </Card>
    </Page>
  );
}

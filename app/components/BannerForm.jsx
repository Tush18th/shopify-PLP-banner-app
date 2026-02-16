import { useState, useCallback } from "react";
import {
  Page,
  Layout,
  Card,
  FormLayout,
  TextField,
  Select,
  Checkbox,
  Button,
  BlockStack,
  InlineStack,
  Text,
  Banner as PolarisBanner,
  Divider,
  Box,
  Tag,
  InlineGrid,
} from "@shopify/polaris";

const TILE_SIZE_OPTIONS = [
  { label: "1x1 (Standard)", value: "SIZE_1x1" },
  { label: "2x1 (Wide)", value: "SIZE_2x1" },
  { label: "2x2 (Large)", value: "SIZE_2x2" },
];

const STATUS_OPTIONS = [
  { label: "Draft", value: "DRAFT" },
  { label: "Active", value: "ACTIVE" },
  { label: "Paused", value: "PAUSED" },
];

const PLACEMENT_TYPE_OPTIONS = [
  { label: "After product index", value: "AFTER_INDEX" },
  { label: "After row number", value: "AFTER_ROW" },
];

const TARGET_TYPE_OPTIONS = [
  { label: "Collection", value: "COLLECTION" },
  { label: "Product Tag", value: "TAG" },
  { label: "Vendor", value: "VENDOR" },
  { label: "Product Type", value: "PRODUCT_TYPE" },
];

export default function BannerForm({
  title,
  banner,
  errors = {},
  success,
  onSave,
  onDelete,
  onDiscard,
}) {
  const [formState, setFormState] = useState({
    name: banner?.name || "",
    status: banner?.status || "DRAFT",
    priority: String(banner?.priority ?? 0),
    title: banner?.title || "",
    subtitle: banner?.subtitle || "",
    desktopImageUrl: banner?.desktopImageUrl || "",
    mobileImageUrl: banner?.mobileImageUrl || "",
    backgroundColor: banner?.backgroundColor || "#ffffff",
    ctaText: banner?.ctaText || "",
    ctaLink: banner?.ctaLink || "",
    openInNewTab: banner?.openInNewTab || false,
    tileSize: banner?.tileSize || "SIZE_1x1",
    startDate: banner?.startDate ? banner.startDate.split("T")[0] : "",
    startTime: banner?.startDate ? banner.startDate.split("T")[1]?.substring(0, 5) || "" : "",
    endDate: banner?.endDate ? banner.endDate.split("T")[0] : "",
    endTime: banner?.endDate ? banner.endDate.split("T")[1]?.substring(0, 5) || "" : "",
    placements: banner?.placements?.map((p) => ({
      placementType: p.placementType,
      position: String(p.position),
    })) || [],
    targetingRules: banner?.targetingRules?.map((r) => ({
      targetType: r.targetType,
      value: r.value,
    })) || [],
  });

  const [isDirty, setIsDirty] = useState(false);

  const updateField = useCallback((field, value) => {
    setFormState((prev) => ({ ...prev, [field]: value }));
    setIsDirty(true);
  }, []);

  // Placement management
  const addPlacement = () => {
    setFormState((prev) => ({
      ...prev,
      placements: [...prev.placements, { placementType: "AFTER_INDEX", position: "6" }],
    }));
    setIsDirty(true);
  };

  const updatePlacement = (index, field, value) => {
    setFormState((prev) => {
      const updated = [...prev.placements];
      updated[index] = { ...updated[index], [field]: value };
      return { ...prev, placements: updated };
    });
    setIsDirty(true);
  };

  const removePlacement = (index) => {
    setFormState((prev) => ({
      ...prev,
      placements: prev.placements.filter((_, i) => i !== index),
    }));
    setIsDirty(true);
  };

  // Targeting management
  const addTargetingRule = () => {
    setFormState((prev) => ({
      ...prev,
      targetingRules: [...prev.targetingRules, { targetType: "COLLECTION", value: "" }],
    }));
    setIsDirty(true);
  };

  const updateTargetingRule = (index, field, value) => {
    setFormState((prev) => {
      const updated = [...prev.targetingRules];
      updated[index] = { ...updated[index], [field]: value };
      return { ...prev, targetingRules: updated };
    });
    setIsDirty(true);
  };

  const removeTargetingRule = (index) => {
    setFormState((prev) => ({
      ...prev,
      targetingRules: prev.targetingRules.filter((_, i) => i !== index),
    }));
    setIsDirty(true);
  };

  const handleSubmit = () => {
    const data = {
      ...formState,
      priority: parseInt(formState.priority, 10) || 0,
      startDate: formState.startDate
        ? new Date(`${formState.startDate}T${formState.startTime || "00:00"}:00`).toISOString()
        : null,
      endDate: formState.endDate
        ? new Date(`${formState.endDate}T${formState.endTime || "23:59"}:00`).toISOString()
        : null,
      placements: formState.placements.map((p) => ({
        placementType: p.placementType,
        position: parseInt(p.position, 10) || 0,
      })),
    };
    onSave(data);
  };

  const hasErrors = Object.keys(errors).length > 0;

  return (
    <Page
      title={title}
      backAction={{ onAction: onDiscard }}
      primaryAction={{
        content: banner ? "Save" : "Create banner",
        onAction: handleSubmit,
        disabled: !isDirty && !!banner,
      }}
      secondaryActions={
        banner
          ? [
              ...(onDelete
                ? [{ content: "Delete", destructive: true, onAction: onDelete }]
                : []),
            ]
          : []
      }
    >
      <BlockStack gap="500">
        {hasErrors && (
          <PolarisBanner tone="critical" title="There were errors with your submission">
            <ul>
              {Object.entries(errors).map(([key, msg]) => (
                <li key={key}>{msg}</li>
              ))}
            </ul>
          </PolarisBanner>
        )}

        {success && (
          <PolarisBanner tone="success" title="Banner saved successfully" />
        )}

        <Layout>
          {/* Main content */}
          <Layout.Section>
            {/* Basic Info */}
            <Card>
              <BlockStack gap="400">
                <Text as="h2" variant="headingMd">Basic Information</Text>
                <FormLayout>
                  <TextField
                    label="Banner name"
                    value={formState.name}
                    onChange={(v) => updateField("name", v)}
                    error={errors.name}
                    autoComplete="off"
                    requiredIndicator
                  />
                  <InlineGrid columns={2} gap="400">
                    <TextField
                      label="Title"
                      value={formState.title}
                      onChange={(v) => updateField("title", v)}
                      error={errors.title}
                      autoComplete="off"
                    />
                    <TextField
                      label="Subtitle"
                      value={formState.subtitle}
                      onChange={(v) => updateField("subtitle", v)}
                      error={errors.subtitle}
                      autoComplete="off"
                    />
                  </InlineGrid>
                </FormLayout>
              </BlockStack>
            </Card>

            {/* Creative */}
            <Card>
              <BlockStack gap="400">
                <Text as="h2" variant="headingMd">Creative</Text>
                <FormLayout>
                  <TextField
                    label="Desktop image URL"
                    value={formState.desktopImageUrl}
                    onChange={(v) => updateField("desktopImageUrl", v)}
                    helpText="Recommended: 600x600px for 1x1, 1200x600px for 2x1, 1200x1200px for 2x2"
                    autoComplete="off"
                  />
                  <TextField
                    label="Mobile image URL"
                    value={formState.mobileImageUrl}
                    onChange={(v) => updateField("mobileImageUrl", v)}
                    helpText="Optional. Falls back to desktop image."
                    autoComplete="off"
                  />
                  <InlineGrid columns={2} gap="400">
                    <TextField
                      label="Background color"
                      type="text"
                      value={formState.backgroundColor}
                      onChange={(v) => updateField("backgroundColor", v)}
                      error={errors.backgroundColor}
                      prefix={
                        <div
                          style={{
                            width: 20,
                            height: 20,
                            backgroundColor: formState.backgroundColor,
                            borderRadius: 4,
                            border: "1px solid #ccc",
                          }}
                        />
                      }
                      autoComplete="off"
                    />
                    <Select
                      label="Tile size"
                      options={TILE_SIZE_OPTIONS}
                      value={formState.tileSize}
                      onChange={(v) => updateField("tileSize", v)}
                    />
                  </InlineGrid>
                </FormLayout>
              </BlockStack>
            </Card>

            {/* CTA */}
            <Card>
              <BlockStack gap="400">
                <Text as="h2" variant="headingMd">Call to Action</Text>
                <FormLayout>
                  <InlineGrid columns={2} gap="400">
                    <TextField
                      label="CTA text"
                      value={formState.ctaText}
                      onChange={(v) => updateField("ctaText", v)}
                      placeholder="Shop Now"
                      autoComplete="off"
                    />
                    <TextField
                      label="CTA link"
                      value={formState.ctaLink}
                      onChange={(v) => updateField("ctaLink", v)}
                      error={errors.ctaLink}
                      placeholder="https://example.com or /collections/sale"
                      autoComplete="off"
                    />
                  </InlineGrid>
                  <Checkbox
                    label="Open link in new tab"
                    checked={formState.openInNewTab}
                    onChange={(v) => updateField("openInNewTab", v)}
                  />
                </FormLayout>
              </BlockStack>
            </Card>

            {/* Placements */}
            <Card>
              <BlockStack gap="400">
                <InlineStack align="space-between">
                  <Text as="h2" variant="headingMd">Placement Rules</Text>
                  <Button onClick={addPlacement} size="slim">
                    Add placement
                  </Button>
                </InlineStack>
                <Text as="p" variant="bodyMd" tone="subdued">
                  Define where this banner appears in the product grid.
                </Text>

                {formState.placements.length === 0 ? (
                  <PolarisBanner tone="warning">
                    <p>No placements defined. Add at least one to display this banner.</p>
                  </PolarisBanner>
                ) : (
                  <BlockStack gap="300">
                    {formState.placements.map((placement, index) => (
                      <Box key={index} padding="300" background="bg-surface-secondary" borderRadius="200">
                        <InlineStack gap="300" blockAlign="end">
                          <div style={{ flex: 1 }}>
                            <Select
                              label="Type"
                              options={PLACEMENT_TYPE_OPTIONS}
                              value={placement.placementType}
                              onChange={(v) => updatePlacement(index, "placementType", v)}
                            />
                          </div>
                          <div style={{ flex: 1 }}>
                            <TextField
                              label={placement.placementType === "AFTER_INDEX" ? "After product #" : "After row #"}
                              type="number"
                              value={placement.position}
                              onChange={(v) => updatePlacement(index, "position", v)}
                              min={0}
                              autoComplete="off"
                            />
                          </div>
                          <Button
                            variant="plain"
                            tone="critical"
                            onClick={() => removePlacement(index)}
                          >
                            Remove
                          </Button>
                        </InlineStack>
                      </Box>
                    ))}
                  </BlockStack>
                )}
              </BlockStack>
            </Card>

            {/* Targeting */}
            <Card>
              <BlockStack gap="400">
                <InlineStack align="space-between">
                  <Text as="h2" variant="headingMd">Targeting Rules</Text>
                  <Button onClick={addTargetingRule} size="slim">
                    Add rule
                  </Button>
                </InlineStack>
                <Text as="p" variant="bodyMd" tone="subdued">
                  Leave empty to show on all collections. Add rules to target specific pages.
                </Text>

                {formState.targetingRules.length > 0 && (
                  <BlockStack gap="300">
                    {formState.targetingRules.map((rule, index) => (
                      <Box key={index} padding="300" background="bg-surface-secondary" borderRadius="200">
                        <InlineStack gap="300" blockAlign="end">
                          <div style={{ flex: 1 }}>
                            <Select
                              label="Target type"
                              options={TARGET_TYPE_OPTIONS}
                              value={rule.targetType}
                              onChange={(v) => updateTargetingRule(index, "targetType", v)}
                            />
                          </div>
                          <div style={{ flex: 2 }}>
                            <TextField
                              label="Value"
                              value={rule.value}
                              onChange={(v) => updateTargetingRule(index, "value", v)}
                              placeholder={getTargetPlaceholder(rule.targetType)}
                              autoComplete="off"
                            />
                          </div>
                          <Button
                            variant="plain"
                            tone="critical"
                            onClick={() => removeTargetingRule(index)}
                          >
                            Remove
                          </Button>
                        </InlineStack>
                      </Box>
                    ))}
                  </BlockStack>
                )}
              </BlockStack>
            </Card>
          </Layout.Section>

          {/* Sidebar */}
          <Layout.Section variant="oneThird">
            {/* Status */}
            <Card>
              <BlockStack gap="400">
                <Text as="h2" variant="headingMd">Status</Text>
                <Select
                  label="Banner status"
                  labelHidden
                  options={STATUS_OPTIONS}
                  value={formState.status}
                  onChange={(v) => updateField("status", v)}
                />
                <TextField
                  label="Priority"
                  type="number"
                  value={formState.priority}
                  onChange={(v) => updateField("priority", v)}
                  helpText="Higher number = higher priority when banners conflict"
                  min={0}
                  max={9999}
                  autoComplete="off"
                />
              </BlockStack>
            </Card>

            {/* Scheduling */}
            <Card>
              <BlockStack gap="400">
                <Text as="h2" variant="headingMd">Schedule</Text>
                <FormLayout>
                  <TextField
                    label="Start date"
                    type="date"
                    value={formState.startDate}
                    onChange={(v) => updateField("startDate", v)}
                    autoComplete="off"
                  />
                  <TextField
                    label="Start time"
                    type="time"
                    value={formState.startTime}
                    onChange={(v) => updateField("startTime", v)}
                    autoComplete="off"
                  />
                  <TextField
                    label="End date"
                    type="date"
                    value={formState.endDate}
                    onChange={(v) => updateField("endDate", v)}
                    error={errors.endDate}
                    autoComplete="off"
                  />
                  <TextField
                    label="End time"
                    type="time"
                    value={formState.endTime}
                    onChange={(v) => updateField("endTime", v)}
                    autoComplete="off"
                  />
                </FormLayout>
                <Text as="p" variant="bodySm" tone="subdued">
                  Leave empty for no scheduling. Banners with a future start date will be marked as Scheduled.
                </Text>
              </BlockStack>
            </Card>

            {/* Preview */}
            <Card>
              <BlockStack gap="400">
                <Text as="h2" variant="headingMd">Preview</Text>
                <Box
                  padding="400"
                  borderRadius="200"
                  background="bg-surface-secondary"
                  minHeight="200px"
                >
                  <div
                    style={{
                      backgroundColor: formState.backgroundColor,
                      borderRadius: 8,
                      padding: 16,
                      minHeight: 160,
                      display: "flex",
                      flexDirection: "column",
                      justifyContent: "center",
                      alignItems: "center",
                      textAlign: "center",
                      position: "relative",
                      overflow: "hidden",
                    }}
                  >
                    {formState.desktopImageUrl && (
                      <img
                        src={formState.desktopImageUrl}
                        alt="Preview"
                        style={{
                          position: "absolute",
                          top: 0,
                          left: 0,
                          width: "100%",
                          height: "100%",
                          objectFit: "cover",
                        }}
                        onError={(e) => { e.target.style.display = "none"; }}
                      />
                    )}
                    <div style={{ position: "relative", zIndex: 1 }}>
                      {formState.title && (
                        <Text as="p" variant="headingMd">
                          {formState.title}
                        </Text>
                      )}
                      {formState.subtitle && (
                        <Text as="p" variant="bodySm" tone="subdued">
                          {formState.subtitle}
                        </Text>
                      )}
                      {formState.ctaText && (
                        <div style={{ marginTop: 8 }}>
                          <Tag>{formState.ctaText}</Tag>
                        </div>
                      )}
                    </div>
                  </div>
                  <Text as="p" variant="bodySm" tone="subdued" alignment="center">
                    {formState.tileSize.replace("SIZE_", "")} tile
                  </Text>
                </Box>
              </BlockStack>
            </Card>
          </Layout.Section>
        </Layout>
      </BlockStack>
    </Page>
  );
}

function getTargetPlaceholder(type) {
  switch (type) {
    case "COLLECTION":
      return "Collection handle or ID";
    case "TAG":
      return "Product tag name";
    case "VENDOR":
      return "Vendor name";
    case "PRODUCT_TYPE":
      return "Product type";
    default:
      return "Value";
  }
}

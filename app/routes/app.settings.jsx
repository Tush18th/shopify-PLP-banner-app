import { json } from "@remix-run/node";
import { useActionData, useLoaderData, useSubmit } from "@remix-run/react";
import {
  Page,
  Layout,
  Card,
  BlockStack,
  Text,
  TextField,
  Select,
  Button,
  Banner,
  FormLayout,
} from "@shopify/polaris";
import { useState } from "react";
import { authenticate } from "../shopify.server";
import { getShop, updateShop } from "../models/shop.server";

const TIMEZONE_OPTIONS = [
  { label: "UTC", value: "UTC" },
  { label: "US/Eastern", value: "America/New_York" },
  { label: "US/Central", value: "America/Chicago" },
  { label: "US/Mountain", value: "America/Denver" },
  { label: "US/Pacific", value: "America/Los_Angeles" },
  { label: "Europe/London", value: "Europe/London" },
  { label: "Europe/Paris", value: "Europe/Paris" },
  { label: "Europe/Berlin", value: "Europe/Berlin" },
  { label: "Asia/Tokyo", value: "Asia/Tokyo" },
  { label: "Asia/Shanghai", value: "Asia/Shanghai" },
  { label: "Asia/Kolkata", value: "Asia/Kolkata" },
  { label: "Australia/Sydney", value: "Australia/Sydney" },
];

export const loader = async ({ request }) => {
  const { session } = await authenticate.admin(request);
  const shop = await getShop(session.shop);
  return json({ shop });
};

export const action = async ({ request }) => {
  const { session } = await authenticate.admin(request);
  const formData = await request.formData();
  const timezone = formData.get("timezone");

  if (!timezone) {
    return json({ error: "Timezone is required" }, { status: 400 });
  }

  await updateShop(session.shop, { timezone });

  return json({ success: true });
};

export default function Settings() {
  const { shop } = useLoaderData();
  const actionData = useActionData();
  const submit = useSubmit();
  const [timezone, setTimezone] = useState(shop.timezone || "UTC");

  const handleSave = () => {
    const formData = new FormData();
    formData.set("timezone", timezone);
    submit(formData, { method: "post" });
  };

  return (
    <Page title="Settings">
      <Layout>
        <Layout.AnnotatedSection
          title="Store Settings"
          description="Configure your store timezone for banner scheduling."
        >
          <Card>
            <BlockStack gap="400">
              {actionData?.success && (
                <Banner tone="success" title="Settings saved" />
              )}
              {actionData?.error && (
                <Banner tone="critical" title={actionData.error} />
              )}
              <FormLayout>
                <Select
                  label="Store timezone"
                  options={TIMEZONE_OPTIONS}
                  value={timezone}
                  onChange={setTimezone}
                  helpText="Used for scheduling banner start/end times"
                />
              </FormLayout>
              <Button variant="primary" onClick={handleSave}>
                Save settings
              </Button>
            </BlockStack>
          </Card>
        </Layout.AnnotatedSection>

        <Layout.AnnotatedSection
          title="Theme Setup"
          description="Enable the PLP Banner app embed in your theme."
        >
          <Card>
            <BlockStack gap="300">
              <Text as="p" variant="bodyMd">
                To display banners on your storefront, you need to enable the app embed in your theme customizer:
              </Text>
              <Text as="p" variant="bodyMd">
                1. Go to <strong>Online Store &gt; Themes &gt; Customize</strong>
              </Text>
              <Text as="p" variant="bodyMd">
                2. Click <strong>App embeds</strong> in the left sidebar
              </Text>
              <Text as="p" variant="bodyMd">
                3. Toggle on <strong>PLP Banner Injector</strong>
              </Text>
              <Text as="p" variant="bodyMd">
                4. Save the theme
              </Text>
            </BlockStack>
          </Card>
        </Layout.AnnotatedSection>
      </Layout>
    </Page>
  );
}

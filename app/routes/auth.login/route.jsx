import { useState } from "react";
import { Form, useActionData, useLoaderData } from "@remix-run/react";
import { json } from "@remix-run/node";
import {
  AppProvider,
  Page,
  Card,
  FormLayout,
  TextField,
  Button,
  Banner,
} from "@shopify/polaris";
import polarisTranslations from "@shopify/polaris/locales/en.json";
import polarisStyles from "@shopify/polaris/build/esm/styles.css?url";
import { login } from "../../shopify.server";

export const links = () => [{ rel: "stylesheet", href: polarisStyles }];

export const loader = async ({ request }) => {
  const errors = await login(request);
  return json({ errors, polarisTranslations });
};

export const action = async ({ request }) => {
  const errors = await login(request);
  return json({ errors });
};

export default function Auth() {
  const { polarisTranslations } = useLoaderData();
  const actionData = useActionData();
  const [shop, setShop] = useState("");

  return (
    <AppProvider i18n={polarisTranslations}>
      <Page narrowWidth>
        <Card>
          <Form method="post">
            {actionData?.errors?.shop && (
              <Banner tone="critical">
                <p>{actionData.errors.shop}</p>
              </Banner>
            )}
            <FormLayout>
              <TextField
                type="text"
                name="shop"
                label="Shop domain"
                helpText="e.g. my-store.myshopify.com"
                value={shop}
                onChange={setShop}
                autoComplete="on"
                placeholder="my-store.myshopify.com"
              />
              <Button submit variant="primary">
                Log in
              </Button>
            </FormLayout>
          </Form>
        </Card>
      </Page>
    </AppProvider>
  );
}

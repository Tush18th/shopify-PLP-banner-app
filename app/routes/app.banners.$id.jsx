import { json, redirect } from "@remix-run/node";
import { useActionData, useLoaderData, useNavigate, useSubmit } from "@remix-run/react";
import { authenticate } from "../shopify.server";
import { getShop } from "../models/shop.server";
import { getBanner, updateBanner, deleteBanner } from "../models/banner.server";
import { validateBannerData } from "../utils/validation.server";
import BannerForm from "../components/BannerForm";

export const loader = async ({ request, params }) => {
  const { session } = await authenticate.admin(request);
  const shop = await getShop(session.shop);
  const bannerId = parseInt(params.id, 10);

  const banner = await getBanner(bannerId, shop.id);
  if (!banner) {
    throw new Response("Banner not found", { status: 404 });
  }

  return json({ banner });
};

export const action = async ({ request, params }) => {
  const { session } = await authenticate.admin(request);
  const shop = await getShop(session.shop);
  const bannerId = parseInt(params.id, 10);

  const formData = await request.formData();
  const intent = formData.get("intent");

  if (intent === "delete") {
    await deleteBanner(bannerId, shop.id);
    return redirect("/app/banners");
  }

  const raw = formData.get("bannerData");
  if (!raw) {
    return json({ errors: { form: "No data submitted" } }, { status: 400 });
  }

  let data;
  try {
    data = JSON.parse(raw);
  } catch {
    return json({ errors: { form: "Invalid data format" } }, { status: 400 });
  }

  const errors = validateBannerData(data);
  if (Object.keys(errors).length > 0) {
    return json({ errors }, { status: 422 });
  }

  // Determine status based on scheduling
  if (data.status === "ACTIVE" && data.startDate) {
    const start = new Date(data.startDate);
    if (start > new Date()) {
      data.status = "SCHEDULED";
    }
  }

  await updateBanner(bannerId, shop.id, {
    name: data.name,
    status: data.status || "DRAFT",
    priority: parseInt(data.priority, 10) || 0,
    title: data.title || null,
    subtitle: data.subtitle || null,
    desktopImageUrl: data.desktopImageUrl || null,
    mobileImageUrl: data.mobileImageUrl || null,
    backgroundColor: data.backgroundColor || "#ffffff",
    ctaText: data.ctaText || null,
    ctaLink: data.ctaLink || null,
    openInNewTab: Boolean(data.openInNewTab),
    tileSize: data.tileSize || "SIZE_1x1",
    startDate: data.startDate ? new Date(data.startDate) : null,
    endDate: data.endDate ? new Date(data.endDate) : null,
    placements: (data.placements || []).map((p) => ({
      placementType: p.placementType,
      position: parseInt(p.position, 10),
    })),
    targetingRules: (data.targetingRules || []).map((r) => ({
      targetType: r.targetType,
      value: r.value,
    })),
  });

  return json({ success: true });
};

export default function EditBanner() {
  const { banner } = useLoaderData();
  const actionData = useActionData();
  const navigate = useNavigate();
  const submit = useSubmit();

  const handleSave = (data) => {
    const formData = new FormData();
    formData.set("bannerData", JSON.stringify(data));
    submit(formData, { method: "post" });
  };

  const handleDelete = () => {
    if (!confirm("Are you sure you want to delete this banner?")) return;
    const formData = new FormData();
    formData.set("intent", "delete");
    submit(formData, { method: "post" });
  };

  return (
    <BannerForm
      title={`Edit: ${banner.name}`}
      banner={banner}
      errors={actionData?.errors}
      success={actionData?.success}
      onSave={handleSave}
      onDelete={handleDelete}
      onDiscard={() => navigate("/app/banners")}
    />
  );
}

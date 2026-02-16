import prisma from "../db.server";

/**
 * Get or create a shop record by domain.
 */
export async function getShop(domain) {
  return prisma.shop.upsert({
    where: { domain },
    update: {},
    create: { domain, name: domain },
  });
}

/**
 * Update shop settings (timezone, etc).
 */
export async function updateShop(domain, data) {
  return prisma.shop.update({
    where: { domain },
    data,
  });
}

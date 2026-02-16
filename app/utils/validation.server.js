/**
 * Validate banner form data.
 * Returns an object with errors (empty if valid).
 */
export function validateBannerData(data) {
  const errors = {};

  if (!data.name || data.name.trim().length === 0) {
    errors.name = "Name is required";
  } else if (data.name.length > 255) {
    errors.name = "Name must be under 255 characters";
  }

  if (data.title && data.title.length > 255) {
    errors.title = "Title must be under 255 characters";
  }

  if (data.subtitle && data.subtitle.length > 500) {
    errors.subtitle = "Subtitle must be under 500 characters";
  }

  if (data.ctaLink && !isValidUrl(data.ctaLink)) {
    errors.ctaLink = "CTA link must be a valid URL or relative path";
  }

  if (data.backgroundColor && !isValidColor(data.backgroundColor)) {
    errors.backgroundColor = "Invalid color format";
  }

  if (data.priority !== undefined && data.priority !== null) {
    const p = Number(data.priority);
    if (isNaN(p) || p < 0 || p > 9999) {
      errors.priority = "Priority must be a number between 0 and 9999";
    }
  }

  const validStatuses = ["DRAFT", "ACTIVE", "SCHEDULED", "PAUSED", "EXPIRED"];
  if (data.status && !validStatuses.includes(data.status)) {
    errors.status = "Invalid status";
  }

  const validTileSizes = ["SIZE_1x1", "SIZE_2x1", "SIZE_2x2"];
  if (data.tileSize && !validTileSizes.includes(data.tileSize)) {
    errors.tileSize = "Invalid tile size";
  }

  // Scheduling validation
  if (data.startDate && data.endDate) {
    const start = new Date(data.startDate);
    const end = new Date(data.endDate);
    if (end <= start) {
      errors.endDate = "End date must be after start date";
    }
  }

  // Placement validation
  if (data.placements) {
    for (let i = 0; i < data.placements.length; i++) {
      const p = data.placements[i];
      const validTypes = ["AFTER_INDEX", "AFTER_ROW"];
      if (!validTypes.includes(p.placementType)) {
        errors[`placements.${i}.type`] = "Invalid placement type";
      }
      if (typeof p.position !== "number" || p.position < 0) {
        errors[`placements.${i}.position`] = "Position must be a non-negative number";
      }
    }
  }

  // Targeting validation
  if (data.targetingRules) {
    const validTargetTypes = ["COLLECTION", "TAG", "VENDOR", "PRODUCT_TYPE"];
    for (let i = 0; i < data.targetingRules.length; i++) {
      const r = data.targetingRules[i];
      if (!validTargetTypes.includes(r.targetType)) {
        errors[`targeting.${i}.type`] = "Invalid target type";
      }
      if (!r.value || r.value.trim().length === 0) {
        errors[`targeting.${i}.value`] = "Target value is required";
      }
    }
  }

  return errors;
}

function isValidUrl(string) {
  // Allow relative URLs starting with /
  if (string.startsWith("/")) return true;
  try {
    new URL(string);
    return true;
  } catch {
    return false;
  }
}

function isValidColor(color) {
  return /^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6}|[0-9a-fA-F]{8})$/.test(color);
}

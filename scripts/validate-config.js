#!/usr/bin/env node
/**
 * validate-config.js
 *
 * Checks shopify.app.toml and required environment variables for leftover
 * placeholder values before a production deployment.
 *
 * Usage:
 *   node scripts/validate-config.js
 *
 * Exits with code 1 if any placeholder is detected, 0 if all clear.
 */

import { readFileSync } from "fs";
import { fileURLToPath } from "url";
import { dirname, resolve } from "path";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, "..");

// ── 1. Check shopify.app.toml for placeholder values ────────────────────────

const TOML_PLACEHOLDERS = [
  "YOUR_CLIENT_ID_FROM_PARTNER_DASHBOARD",
  "YOUR_APP_DOMAIN.com",
  "YOUR-APP-DOMAIN.com",
  "YOUR_DEV_STORE.myshopify.com",
  // Legacy stubs from the original scaffold — must never reach production
  "shopify.dev/apps/default-app-home",
  "example.com/auth",
  "example.com/api/auth",
];

let errors = [];

try {
  const toml = readFileSync(resolve(ROOT, "shopify.app.toml"), "utf8");
  for (const placeholder of TOML_PLACEHOLDERS) {
    if (toml.includes(placeholder)) {
      errors.push(`shopify.app.toml still contains placeholder: "${placeholder}"`);
    }
  }
} catch (e) {
  errors.push(`Could not read shopify.app.toml: ${e.message}`);
}

// ── 2. Check required environment variables ──────────────────────────────────

const REQUIRED_ENV_VARS = [
  "SHOPIFY_API_KEY",
  "SHOPIFY_API_SECRET",
  "SHOPIFY_APP_URL",
  "DATABASE_URL",
  "REDIS_URL",
];

const ENV_PLACEHOLDERS = [
  "your_api_key_here",
  "your_api_secret_here",
  "your-app-domain.com",
  "user:password@localhost",
];

for (const key of REQUIRED_ENV_VARS) {
  const val = process.env[key];
  if (!val) {
    errors.push(`Missing required environment variable: ${key}`);
    continue;
  }
  for (const placeholder of ENV_PLACEHOLDERS) {
    if (val.includes(placeholder)) {
      errors.push(`${key} still contains a placeholder value: "${val}"`);
    }
  }
}

// ── 3. Validate SHOPIFY_APP_URL is HTTPS ─────────────────────────────────────

const appUrl = process.env.SHOPIFY_APP_URL;
if (appUrl && !appUrl.startsWith("https://")) {
  errors.push(`SHOPIFY_APP_URL must use HTTPS in production (got: "${appUrl}")`);
}

// ── 4. Report results ────────────────────────────────────────────────────────

if (errors.length > 0) {
  console.error("\n❌  Configuration validation failed:\n");
  for (const err of errors) {
    console.error(`   • ${err}`);
  }
  console.error(
    "\nFix the above issues before deploying. " +
    "See .env.example and shopify.app.toml comments for guidance.\n"
  );
  process.exit(1);
} else {
  console.log("✅  Configuration looks good — no placeholders detected.");
  process.exit(0);
}

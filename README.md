# Shopify PLP Banner App

A production-ready Shopify Embedded App that enables merchants to create and manage promotional banners inserted directly into collection product grids (Product Listing Pages).

Banners appear as product-like tiles between real products — driving engagement, promotions, and cross-selling.

## Features

- **Banner Management** — Full CRUD with draft/active/scheduled/paused/expired lifecycle
- **Flexible Placement** — Insert after specific product index or row number
- **Targeting Rules** — Target by collection, product tag, vendor, or product type
- **Scheduling** — Start/end date/time with timezone awareness
- **Analytics** — Impression and click tracking with daily aggregates and CTR
- **Responsive** — Adapts to desktop, tablet, and mobile grids
- **Infinite Scroll** — MutationObserver detects grid changes and re-injects
- **Theme App Extension** — Standard Shopify extension for storefront rendering
- **Polaris Admin UI** — Dashboard, banner list, create/edit form, reports page
- **CSV Export** — Export analytics data for external reporting

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Framework | Remix (Shopify App Remix) |
| UI | Shopify Polaris 13 |
| Database | PostgreSQL |
| ORM | Prisma |
| Auth | Shopify OAuth (App Remix) |
| Storefront | Theme App Extension + App Proxy |
| Deployment | Docker / Render / AWS / Fly.io |

## Project Structure

```
├── app/
│   ├── components/
│   │   └── BannerForm.jsx         # Shared create/edit form
│   ├── models/
│   │   ├── analytics.server.js    # Analytics queries
│   │   ├── banner.server.js       # Banner CRUD + storefront queries
│   │   └── shop.server.js         # Shop management
│   ├── routes/
│   │   ├── app._index.jsx         # Dashboard
│   │   ├── app.banners._index.jsx # Banner list
│   │   ├── app.banners.new.jsx    # Create banner
│   │   ├── app.banners.$id.jsx    # Edit banner
│   │   ├── app.reports.jsx        # Analytics reports
│   │   ├── app.settings.jsx       # App settings
│   │   ├── app.jsx                # App layout + nav
│   │   ├── auth.$.jsx             # Auth callback
│   │   ├── auth.login/route.jsx   # Login page
│   │   ├── webhooks.jsx           # Webhook handler
│   │   ├── api.storefront.banners.jsx  # Public banner API
│   │   └── api.storefront.track.jsx    # Analytics tracking API
│   ├── utils/
│   │   ├── validation.server.js   # Input validation
│   │   └── rate-limiter.server.js # Rate limiting
│   ├── db.server.js               # Prisma client
│   ├── shopify.server.js          # Shopify app config
│   ├── entry.server.jsx           # Remix entry
│   └── root.jsx                   # Root layout
├── extensions/
│   └── plp-banner-extension/
│       ├── assets/
│       │   └── plp-banner-injector.js  # Storefront injection JS
│       ├── blocks/
│       │   └── banner-injector.liquid  # App embed block
│       └── shopify.extension.toml
├── prisma/
│   ├── schema.prisma              # Database schema
│   └── seed.js                    # Seed data
├── shopify.app.toml               # Shopify app config
├── Dockerfile
├── package.json
└── vite.config.js
```

## Prerequisites

- Node.js >= 18
- PostgreSQL database
- Shopify Partner account
- Shopify CLI installed (`npm install -g @shopify/cli`)

## Setup

### 1. Clone and Install

```bash
git clone <repo-url>
cd shopify-plp-banner-app
npm install
```

### 2. Create Shopify App

1. Go to [Shopify Partners Dashboard](https://partners.shopify.com)
2. Create a new app
3. Copy the **API Key** and **API Secret**

### 3. Configure Environment

```bash
cp .env.example .env
```

Edit `.env`:
```
SHOPIFY_API_KEY=your_api_key
SHOPIFY_API_SECRET=your_api_secret
SCOPES=read_products,read_themes,write_themes
SHOPIFY_APP_URL=https://your-ngrok-url.ngrok.io
DATABASE_URL=postgresql://user:password@localhost:5432/plp_banner_app
```

### 4. Configure shopify.app.toml

Update `shopify.app.toml`:
- Set `client_id` to your API key
- Set `application_url` to your app URL
- Set `dev_store_url` to your development store

### 5. Database Setup

```bash
# Generate Prisma client
npx prisma generate

# Run migrations
npx prisma migrate dev --name init

# (Optional) Seed sample data
npx prisma db seed
```

### 6. Start Development

```bash
npm run dev
```

This starts the Shopify CLI dev server with ngrok tunneling.

### 7. Enable Theme Extension

1. In your dev store, go to **Online Store > Themes > Customize**
2. Click **App embeds** (left sidebar)
3. Toggle on **PLP Banner Injector**
4. Configure the CSS selectors to match your theme's product grid
5. Save

### 8. Configure App Proxy

In the Shopify Partners dashboard:
1. Go to your app > **App setup**
2. Under **App proxy**, set:
   - Sub path prefix: `apps`
   - Sub path: `plp-banners`
   - Proxy URL: `https://your-app-url.com/api/storefront`

## Admin Pages

| Page | URL | Description |
|------|-----|-------------|
| Dashboard | `/app` | Overview stats, top banners, recent activity |
| Banners | `/app/banners` | List all banners with filters and quick actions |
| Create | `/app/banners/new` | Create a new banner with placement and targeting |
| Edit | `/app/banners/:id` | Edit existing banner |
| Reports | `/app/reports` | Date-range analytics with per-banner breakdown |
| Settings | `/app/settings` | Timezone config and theme setup guide |

## How Banner Injection Works

1. The Theme App Extension loads `plp-banner-injector.js` on collection pages
2. The script calls the App Proxy endpoint to fetch active banners
3. For each banner placement, it calculates the insertion index based on:
   - `AFTER_INDEX` — Insert after the Nth product
   - `AFTER_ROW` — Insert after the Nth row (calculated using current column count)
4. Banner tiles are inserted into the product grid as DOM elements
5. A MutationObserver watches for grid changes (infinite scroll) and re-injects
6. On window resize, column count is rechecked and banners repositioned
7. Impressions and clicks are tracked via the analytics endpoint

## Deployment (Production)

### Option A: Render

1. Create a new **Web Service** on [Render](https://render.com)
2. Connect your repository
3. Set environment: **Docker**
4. Add environment variables from `.env.example`
5. Add a PostgreSQL database
6. Set the `DATABASE_URL` to the Render PostgreSQL connection string

### Option B: Fly.io

```bash
fly launch
fly secrets set SHOPIFY_API_KEY=xxx SHOPIFY_API_SECRET=xxx DATABASE_URL=xxx
fly deploy
```

### Option C: AWS (ECS/Fargate)

1. Build and push Docker image to ECR
2. Create ECS task definition with environment variables
3. Set up an ALB with SSL certificate
4. Configure RDS PostgreSQL instance
5. Deploy the ECS service

### Post-Deployment

1. Update `SHOPIFY_APP_URL` to your production domain
2. Update `shopify.app.toml` with production URLs
3. Run `npx prisma migrate deploy` against production database
4. Deploy the theme extension: `shopify app deploy`
5. Configure the App Proxy URL in Shopify Partners dashboard

### SSL Requirement

Shopify requires HTTPS for all app URLs. Use:
- Render/Fly.io (automatic SSL)
- AWS: ACM certificate + ALB
- Cloudflare: Proxy mode

## Webhook Handling

The app registers and handles these webhooks:

| Topic | Action |
|-------|--------|
| `APP_UNINSTALLED` | Cleans up session data |
| `SHOP_UPDATE` | Updates shop name/timezone/currency |
| `CUSTOMERS_DATA_REQUEST` | Returns empty (no customer data stored) |
| `CUSTOMERS_REDACT` | No-op (no customer data stored) |
| `SHOP_REDACT` | Deletes all shop data |

## Security

- **HMAC Validation** — App Proxy requests verified via Shopify HMAC signature
- **Session Encryption** — Managed by `@shopify/shopify-app-remix`
- **Input Validation** — All API inputs validated server-side
- **Rate Limiting** — Public endpoints rate-limited (120 req/min per IP)
- **Webhook Verification** — Handled by Shopify App Remix authenticate.webhook
- **CORS** — Controlled Access-Control headers on public endpoints
- **XSS Prevention** — HTML/attribute escaping in storefront JS

## Database Schema

```
Shop (1) ──── (N) Banner
Banner (1) ──── (N) BannerPlacement
Banner (1) ──── (N) BannerTargetingRule
Banner (1) ──── (N) BannerAnalyticsDaily
```

See `prisma/schema.prisma` for the full schema definition.

## License

MIT

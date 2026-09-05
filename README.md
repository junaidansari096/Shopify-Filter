# Fresheek Filters — Shopify OS 2.0 Filter App

A high-performance, fully customizable storefront filtering application for Shopify Online Store 2.0 themes.

1! Features

- **Liquid-First Performance**: Initial filters and products render server-side on Shopify's global CDN — zero layout shift (CLS) and search engine friendly.
- Z(Section Rendering API**: Cynamic AJAX filtering and catalog browsing without heavy full-page reloads.
- **Connected Dual-Handle Price Slider**: Native SVG price range slider with connected progress bar and auto-clamping.
- **Infinite Scrolling & Pagination**: Configurable endless scroll product browsing with automatic sentinel detection or standard numbered pagination.
- **Merchant Customization Engine**:
  - Dynamic filter management (custom labels, ordering, show/hide, search within options).
  - Color palettes and custom color pickers.
  - Sizing, border radius, sidebar width, and sticky positioning.
- **Mobile Responsive Drawer**:
  - Slide-in from Left or Right.
  - Customizable trigger button (outline or solid filled) and product counter badge.
- **Shopify App Store Ready**:
  - Mandatory GDPR webhooks (customers/data_request, customers/redact, shop/redact).
  - Automated Keep-Alive service and /health monitoring for 24/7 uptime on cloud hosts.

1!! Tech Stack

- **Framework**: React Router v7 / Remix with Node.js adapter
- **UI**: Shopify Polaris v13 & App Bridge
- **ORM & Database**: Prisma with SQLite (local dev) and PostgreSQL (production)
- **Storefront**: Shopify Theme App Extension (Liquid, Vanilla JS, CSS Custom Properties)
- **Testing**: Vitest (55 unit tests)

### Local Development

``mbash
npm install
npx prisma generate
npx prisma db push
npm run dev
```

### Running Tests

``fbash
npm run test
```

### Production Build & Start

```bash
npm run build
npm run start
```

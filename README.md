# مستودع ليلى للمياه

A mobile-friendly bottled water ordering application with a Node.js API and persistent SQLite orders. Uses Node.js 24 or newer, with no runtime package dependencies.

## Develop

```sh
cd /workspace/MobileApp-Sami_water
npm ci
npm test
npm start
```

The server listens on port 3000 (override with `PORT`). SQLite data is stored in `data/orders.sqlite`, outside version control. Set `DB_PATH` for a different persistent location. Back up this database before moving or deploying the app. No external credentials are required for local development.

## Included

- Responsive storefront with Safia 1.5 L single bottles (0.900 TND) and six-packs (4.500 TND, or 0.750 TND per bottle).
- Cart retained in the browser, with quantity controls.
- Customer and delivery details, next-seven-days scheduling, and cash on delivery.
- Server-side product, quantity, address, and date validation; authoritative totals and free-delivery calculation.
- SQLite order persistence, UUID order references, and an order receipt.
- Automated API and database integration tests.

Products and pricing are configured in `server.js`. This initial catalog and the مستودع ليلى للمياه branding are provisional. No product sourcing or water-quality claims are made.

## Before accepting real customers

This is a working first implementation, not an operational delivery business. Orders are recorded locally, but nobody is notified or dispatched automatically. There is no administrator interface, customer login, online payment, stock management, cancellation workflow, or SMS/email service yet. Dates represent requested windows rather than reserved delivery capacity.

Confirm the actual business name, service area, currency, prices, bottle deposits, tax treatment, and delivery policies. Connect dispatch and order management, configure privacy/retention policies and legal terms, and deploy behind HTTPS with persistent storage, database backups, request rate limiting, and monitoring. Do not publish the local server directly for real customer orders before these steps are completed.

## API

- `GET /api/health` — service health.
- `GET /api/products` — product catalog and delivery pricing, in integer millimes (1 TND = 1,000 millimes).
- `POST /api/orders` — validates and stores an order; returns an order receipt. Only JSON is accepted.

Customer records are not exposed by a public read API. Inspect orders only through trusted local database access until an authenticated administration workflow exists.

Delivery remains provisional: 2.500 TND, waived for product subtotals of at least 25.000 TND. These delivery terms require business confirmation. Existing orders retain the currency and prices recorded at purchase.

## Languages and product photos

The storefront defaults to French and supports Arabic with right-to-left layout. Language preference persists in the browser; switching languages preserves cart and delivery details. Translation strings and product descriptions live in `public/i18n.js`.

Fourat 2 L is 0.800 TND per bottle. Marwa is 0.850 TND per bottle; its capacity has not yet been confirmed. Safia pricing is unchanged.

Product photos supplied by the owner are stored at `public/images/safia.jpeg`, `public/images/fourat.jpeg`, and `public/images/marwa.jpeg`. The Safia single uses `safia.jpeg`; the six-pack uses the newly uploaded `safia1.jpg`. The API serves these exact files. Safia capacity is omitted from the catalog pending confirmation: the newly supplied photo shows a 900 ml glass bottle, while the earlier photo showed 1.5 L plastic bottles. Prices remain unchanged.

Product photos display without cropping and open in a full-size dialog on tap or keyboard activation. The viewer supports a close button, Escape, and backdrop dismissal. The Arabic logo combines a warehouse roof and water drop with the business name.

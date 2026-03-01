# Demo E-Commerce Page — Task Spec

## Purpose

A self-contained fake e-commerce store used for the hackathon demo. Two visual themes (V1: "ShopMart", V2: "NovaBuy") that serve the same product data but with dramatically different layouts, element names, DOM structure, and styling. The theme toggle is the setup for the self-healing demo moment.

---

## Pages

### 1. Homepage / Search Results

- A search bar at the top
- A grid of product cards showing: image, name, price, rating
- Clicking a product navigates to the detail page
- Search filters the product list by name (client-side, instant)

### 2. Product Detail

- Product image
- Product name, price, stock status, rating, description
- A primary action button ("Add to Cart" in V1, "Buy Now" in V2)
- A "back to results" link

Both pages are a single SPA (or two HTML pages with shared data). No backend — everything is static/client-side.

---

## Product Data

Generate 12 products using `@faker-js/faker` in a build script. Output to `products.json`.

Each product:

```typescript
{
  id: string,            // faker.string.uuid()
  name: string,          // faker.commerce.productName()
  price: number,         // faker.commerce.price({ min: 20, max: 800 })
  currency: "USD",
  rating: number,        // faker.number.float({ min: 3.0, max: 5.0, fractionDigits: 1 })
  reviewCount: number,   // faker.number.int({ min: 10, max: 5000 })
  inStock: boolean,      // faker.datatype.boolean({ probability: 0.8 })
  description: string,   // faker.commerce.productDescription()
  image: string,         // faker.image.urlPicsumPhotos({ width: 400, height: 400 })
  category: string,      // faker.commerce.department()
  sku: string,           // faker.string.alphanumeric(8).toUpperCase()
}
```

Seed the faker instance (`faker.seed(42)`) so products are deterministic across rebuilds.

Additionally, hardcode one "hero" product that the demo always uses:

```typescript
{
  id: "hero-001",
  name: "AirPods Max",
  price: 549.00,
  currency: "USD",
  rating: 4.5,
  reviewCount: 2847,
  inStock: true,
  description: "Premium over-ear headphones with active noise cancellation, spatial audio, and a breathable knit mesh canopy.",
  image: "https://picsum.photos/seed/airpods/400/400",
  category: "Electronics",
  sku: "APM00001"
}
```

This ensures the demo target product is always present and predictable.

### Build script

```
demo/generate-products.mjs
```

Runs with `node generate-products.mjs`, writes `demo/products.json`. Checked into the repo so the page works without running the script.

---

## Theme A — "ShopMart"

The version recorded against. Clean, conventional, light.

### Visual identity
- White background, blue primary color (`#2563eb`)
- Clean sans-serif font (Inter or system font stack)
- Minimal design, lots of whitespace

### Search results layout
- Top nav bar with logo "ShopMart" + search input
- Product **grid** (3 columns on desktop)
- Cards: image on top, name below, price below name, star icons for rating

### Product detail layout
- Two-column: image left (50%), product info right (50%)
- Price displayed as `$549.00` (dollar sign, two decimals)
- Rating as star icons: ★★★★½ (4.5)
- Stock status as green text: "In Stock" / red text: "Out of Stock"
- Button: green background, white text, label **"Add to Cart"**

### DOM structure (examples)
```html
<div class="product-card">
  <img class="product-card__image" src="..." />
  <h3 class="product-card__name">AirPods Max</h3>
  <span class="product-card__price">$549.00</span>
  <div class="product-card__rating">★★★★½</div>
</div>

<button class="btn btn-primary add-to-cart">Add to Cart</button>
<span class="stock-status in-stock">In Stock</span>
```

---

## Theme B — "NovaBuy"

The version that tests self-healing. Everything is different visually and structurally, but semantically equivalent.

### Visual identity
- Dark background (`#0f0f0f`), purple/gradient accents (`#8b5cf6` → `#6366f1`)
- Different font (monospace headers, sans body)
- Dense, modern/techy aesthetic

### Search results layout
- Side nav with logo "NovaBuy" + search input in a top bar
- Product **horizontal list** (single column, cards are wide with image on the left)
- Cards: image left, name + price + rating on the right
- Promotional banner at the top: "🔥 Summer Sale — Up to 40% off"

### Product detail layout
- Single column: full-width image on top, info below
- Price displayed as `549 USD` (no dollar sign, no decimals, currency after)
- Rating as text: "4.5 out of 5" with a small progress bar
- Stock status as a colored dot: 🟢 "Available" / 🔴 "Sold Out"
- Button: gradient background, label **"Buy Now"**
- Extra noise: "Customers also viewed" section below, cookie consent banner

### DOM structure (examples)
```html
<article class="listing-item" data-product-id="hero-001">
  <figure><img src="..." /></figure>
  <div class="listing-item-details">
    <h2>AirPods Max</h2>
    <p class="item-cost">549 USD</p>
    <span class="item-rating">4.5 out of 5</span>
  </div>
</article>

<button class="action-btn action-btn--purchase">Buy Now</button>
<span class="availability available">🟢 Available</span>
```

---

## Theme Toggle

A visible toggle in the bottom-right corner of the page. Labeled "Site Redesign" or "Switch Theme."

On click:
- Swaps the CSS (theme-a ↔ theme-b)
- Swaps the HTML template/layout (different DOM structure for cards, detail page)
- Updates element labels (Add to Cart ↔ Buy Now, In Stock ↔ Available, etc.)
- Updates price formatting ($549.00 ↔ 549 USD)
- Updates rating display (stars ↔ text)
- Adds/removes noise elements (banners, cookie popup, related products)

The toggle should have a short transition animation so the switch looks dramatic on stage. The page should NOT reload — it's an instant swap.

Alternatively, support `?theme=shopmart` and `?theme=novabuy` URL params so the browser agent can be pointed at a specific version.

---

## Implementation Details

### Tech stack
- Vite + vanilla TypeScript (no framework needed)
- Two CSS files: `theme-shopmart.css`, `theme-novabuy.css`
- Client-side routing: hash-based (`#/` for search results, `#/product/{id}` for detail)

### File structure

```
demo/
├── index.html
├── src/
│   ├── main.ts              — app entry, routing, theme toggle
│   ├── products.ts           — loads products.json, search/filter logic
│   ├── render-shopmart.ts    — renders pages in ShopMart theme (DOM structure A)
│   ├── render-novabuy.ts     — renders pages in NovaBuy theme (DOM structure B)
│   └── theme.ts              — toggle logic, URL param handling
├── products.json              — generated product data
├── generate-products.mjs      — faker script to regenerate products
├── theme-shopmart.css
├── theme-novabuy.css
├── package.json
└── tsconfig.json
```

Separate render functions per theme ensures the DOM structure is genuinely different, not just restyled with CSS.

### Build & serve

```bash
cd demo && npm install && npm run dev    # vite dev server on :5174
cd demo && npm run generate              # regenerate products.json
```

### Key behaviors

- Searching filters products client-side (case-insensitive substring match on product name)
- Clicking a product card navigates to `#/product/{id}`
- Back link returns to `#/` (preserving search query)
- Theme toggle persists via `localStorage` and URL param
- All product images use `picsum.photos` with seeded URLs (deterministic, no broken images)

---

## Summary of differences for self-healing demo

| Element | ShopMart (V1) | NovaBuy (V2) |
|---------|--------------|--------------|
| **Brand** | ShopMart | NovaBuy |
| **Background** | White | Dark (#0f0f0f) |
| **Layout (search)** | 3-column grid | Single-column horizontal list |
| **Layout (detail)** | Image left, info right | Full-width image top, info below |
| **Buy button** | "Add to Cart" (green) | "Buy Now" (gradient purple) |
| **Price format** | $549.00 | 549 USD |
| **Rating** | ★★★★½ | "4.5 out of 5" + progress bar |
| **Stock** | "In Stock" (green text) | 🟢 "Available" |
| **Card element** | `div.product-card` | `article.listing-item` |
| **Price element** | `span.product-card__price` | `p.item-cost` |
| **Extra noise** | None | Sale banner, cookie popup, "Also viewed" |
| **CSS classes** | BEM (`product-card__name`) | Flat (`listing-item-details`) |

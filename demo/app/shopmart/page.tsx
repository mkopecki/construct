import Link from "next/link";
import { getProducts } from "@/lib/products";
import ProductCard from "@/components/shopmart/ProductCard";

export default function ShopMartPage() {
  const products = getProducts();

  return (
    <>
      {/* Navigation */}
      <nav className="shopmart-nav sticky top-0 z-30 border-b border-[#e2e8f0] bg-white/80 backdrop-blur-xl">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-4">
          <div className="flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-[#2563eb]">
              <span className="text-sm font-bold text-white">S</span>
            </div>
            <span className="shopmart-logo text-xl font-bold text-[#0f172a] tracking-tight">
              Shop<span className="text-[#2563eb]">Mart</span>
            </span>
          </div>
          <Link
            href="/shopmart/search"
            className="search-trigger flex items-center gap-2 rounded-lg border border-[#e2e8f0] bg-white px-4 py-2 text-sm text-[#94a3b8] transition-all hover:border-[#cbd5e1] hover:text-[#64748b] hover:shadow-sm"
          >
            <svg
              width="16"
              height="16"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <circle cx="11" cy="11" r="8" />
              <path d="m21 21-4.3-4.3" />
            </svg>
            Search products...
          </Link>
        </div>
      </nav>

      {/* Content */}
      <main className="mx-auto max-w-6xl px-6 py-8">
        <div className="mb-8">
          <h1 className="font-[family-name:var(--font-instrument)] text-3xl text-[#0f172a]">
            All Products
          </h1>
          <p className="mt-1 text-sm text-[#94a3b8]">
            Discover quality products at great prices
          </p>
        </div>

        <div className="product-grid grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
          {products.map((product) => (
            <ProductCard key={product.id} product={product} />
          ))}
        </div>
      </main>
    </>
  );
}

import { Suspense } from "react";
import { searchProducts, getProducts } from "@/lib/products";
import ProductCard from "@/components/shopmart/ProductCard";
import ShopMartSearchBar from "@/components/shopmart/SearchBar";

function ProductGrid({ query }: { query: string }) {
  const products = query ? searchProducts(query) : getProducts();

  return (
    <>
      {products.length === 0 ? (
        <div className="col-span-full flex flex-col items-center justify-center py-20">
          <p className="text-lg font-medium text-[#64748b]">No products found</p>
          <p className="text-sm text-[#94a3b8] mt-1">Try a different search term</p>
        </div>
      ) : (
        <div className="product-grid grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
          {products.map((product) => (
            <ProductCard key={product.id} product={product} />
          ))}
        </div>
      )}
    </>
  );
}

export default async function ShopMartPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>;
}) {
  const { q = "" } = await searchParams;

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
          <Suspense>
            <ShopMartSearchBar />
          </Suspense>
        </div>
      </nav>

      {/* Content */}
      <main className="mx-auto max-w-6xl px-6 py-8">
        <div className="mb-8">
          <h1 className="font-[family-name:var(--font-instrument)] text-3xl text-[#0f172a]">
            {q ? `Results for "${q}"` : "All Products"}
          </h1>
          <p className="mt-1 text-sm text-[#94a3b8]">
            Discover quality products at great prices
          </p>
        </div>

        <ProductGrid query={q} />
      </main>
    </>
  );
}

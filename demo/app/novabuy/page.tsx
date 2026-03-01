import { Suspense } from "react";
import { searchProducts, getProducts } from "@/lib/products";
import ListingItem from "@/components/novabuy/ListingItem";
import NovaBuySearchBar from "@/components/novabuy/SearchBar";
import SaleBanner from "@/components/novabuy/SaleBanner";

function ProductList({ query }: { query: string }) {
  const products = query ? searchProducts(query) : getProducts();

  return (
    <>
      {products.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20">
          <p className="font-[family-name:var(--font-jetbrains)] text-sm text-[#6b7280] uppercase tracking-wider">
            No results found
          </p>
          <p className="text-xs text-[#4b5563] mt-1">Adjust your search query</p>
        </div>
      ) : (
        <div className="product-list flex flex-col gap-3">
          {products.map((product) => (
            <ListingItem key={product.id} product={product} />
          ))}
        </div>
      )}
    </>
  );
}

export default async function NovaBuyPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>;
}) {
  const { q = "" } = await searchParams;

  return (
    <>
      {/* Navigation */}
      <nav className="novabuy-nav sticky top-0 z-30 border-b border-[#1f1f1f] bg-[#0f0f0f]/80 backdrop-blur-xl">
        <div className="mx-auto flex max-w-4xl items-center justify-between px-6 py-4">
          <div className="flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br from-[#8b5cf6] to-[#6366f1]">
              <span className="text-sm font-bold text-white">N</span>
            </div>
            <span className="novabuy-logo font-[family-name:var(--font-jetbrains)] text-lg font-bold text-[#f5f5f5] tracking-tight">
              Nova<span className="bg-gradient-to-r from-[#8b5cf6] to-[#6366f1] bg-clip-text text-transparent">Buy</span>
            </span>
          </div>
          <Suspense>
            <NovaBuySearchBar />
          </Suspense>
        </div>
      </nav>

      {/* Content */}
      <main className="mx-auto max-w-4xl px-6 py-8">
        <SaleBanner />

        <div className="mb-6">
          <h1 className="font-[family-name:var(--font-jetbrains)] text-xl font-bold text-[#f5f5f5] tracking-tight">
            {q ? `Search: "${q}"` : "All Listings"}
          </h1>
          <p className="mt-1 text-xs text-[#6b7280]">
            Premium tech marketplace
          </p>
        </div>

        <ProductList query={q} />
      </main>
    </>
  );
}

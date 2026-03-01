import { notFound } from "next/navigation";
import { getProduct, getProducts } from "@/lib/products";
import NovaBuyProductDetail from "@/components/novabuy/ProductDetail";

export default async function NovaBuyProductPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const product = getProduct(id);

  if (!product) notFound();

  // Get 4 random related products (excluding current)
  const allProducts = getProducts().filter((p) => p.id !== id);
  const related = allProducts.slice(0, 4);

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
        </div>
      </nav>

      <NovaBuyProductDetail product={product} relatedProducts={related} />
    </>
  );
}

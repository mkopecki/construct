import { notFound } from "next/navigation";
import { getProduct } from "@/lib/products";
import ShopMartProductDetail from "@/components/shopmart/ProductDetail";

export default async function ShopMartProductPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const product = getProduct(id);

  if (!product) notFound();

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
        </div>
      </nav>

      <ShopMartProductDetail product={product} />
    </>
  );
}

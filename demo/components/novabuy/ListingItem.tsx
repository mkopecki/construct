import Link from "next/link";
import Image from "next/image";
import { Card, CardContent } from "@/components/ui/card";
import type { Product } from "@/lib/types";

export default function ListingItem({ product }: { product: Product }) {
  return (
    <Link href={`/novabuy/product/${product.id}`} className="group block">
      <Card className="listing-item overflow-hidden border-[#1f1f1f] bg-[#141414] py-0 shadow-none transition-all duration-300 hover:border-[#8b5cf6]/30 hover:bg-[#1a1a1a] hover:shadow-lg hover:shadow-[#8b5cf6]/5">
        <CardContent className="listing-item-details flex gap-5 p-0">
          {/* Image — Left */}
          <div className="listing-item-image relative h-36 w-44 shrink-0 overflow-hidden bg-[#0a0a0a]">
            <Image
              src={product.image}
              alt={product.name}
              fill
              className="object-cover transition-transform duration-500 group-hover:scale-105"
              sizes="176px"
            />
            {!product.inStock && (
              <div className="absolute inset-0 flex items-center justify-center bg-black/60">
                <span className="font-[family-name:var(--font-jetbrains)] text-[10px] font-bold uppercase tracking-widest text-[#ef4444]">
                  Sold Out
                </span>
              </div>
            )}
          </div>

          {/* Details — Right */}
          <div className="flex flex-1 flex-col justify-center gap-2 py-4 pr-5">
            <div className="flex items-center gap-2">
              <span className="listing-item-category font-[family-name:var(--font-jetbrains)] text-[10px] uppercase tracking-widest text-[#8b5cf6] font-semibold">
                {product.category}
              </span>
              <span className="text-[10px] text-[#4b5563]">•</span>
              <span className="text-[10px] text-[#6b7280] uppercase tracking-wider">
                {product.brand}
              </span>
            </div>
            <h3 className="listing-item-name font-[family-name:var(--font-manrope)] text-base font-semibold text-[#e5e5e5] leading-snug group-hover:text-white transition-colors">
              {product.name}
            </h3>
            <p className="text-xs text-[#6b7280] line-clamp-1">
              {product.description}
            </p>
            <div className="flex items-center gap-4 mt-1">
              <span className="item-cost font-[family-name:var(--font-jetbrains)] text-lg font-bold text-[#e5e5e5]">
                {product.price.toFixed(0)} USD
              </span>
              <span className="item-rating text-xs text-[#9ca3af]">
                {product.rating} out of 5
              </span>
              <span className={`availability ${product.inStock ? "available" : "sold-out"} text-xs`}>
                {product.inStock ? (
                  <span className="text-[#22c55e]">🟢 Available</span>
                ) : (
                  <span className="text-[#ef4444]">🔴 Sold Out</span>
                )}
              </span>
            </div>
          </div>
        </CardContent>
      </Card>
    </Link>
  );
}

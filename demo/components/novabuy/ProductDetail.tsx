"use client";

import Image from "next/image";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import type { Product } from "@/lib/types";

function ProgressRating({ rating }: { rating: number }) {
  const pct = (rating / 5) * 100;
  return (
    <div className="item-rating flex items-center gap-3">
      <span className="font-[family-name:var(--font-jetbrains)] text-sm font-semibold text-[#e5e5e5]">
        {rating} out of 5
      </span>
      <div className="h-2 flex-1 max-w-[200px] rounded-full bg-[#1f1f1f] overflow-hidden">
        <div
          className="h-full rounded-full bg-gradient-to-r from-[#8b5cf6] to-[#6366f1] transition-all duration-700"
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  );
}

export default function NovaBuyProductDetail({
  product,
  relatedProducts,
}: {
  product: Product;
  relatedProducts: Product[];
}) {
  return (
    <div className="product-detail mx-auto max-w-3xl px-6 py-8">
      <Link
        href="/novabuy"
        className="back-link mb-6 inline-flex items-center gap-1.5 font-[family-name:var(--font-jetbrains)] text-xs text-[#6b7280] hover:text-[#8b5cf6] transition-colors uppercase tracking-wider font-medium"
      >
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="m15 18-6-6 6-6" />
        </svg>
        Back to listings
      </Link>

      {/* Full-width image — Top */}
      <div className="product-image relative aspect-video w-full overflow-hidden rounded-xl bg-[#0a0a0a] border border-[#1f1f1f] mb-8">
        <Image
          src={product.image}
          alt={product.name}
          fill
          className="object-cover"
          sizes="100vw"
          priority
        />
      </div>

      {/* Info — Below */}
      <div className="product-info flex flex-col gap-5">
        <div className="flex items-center gap-2">
          <span className="font-[family-name:var(--font-jetbrains)] text-[10px] uppercase tracking-widest text-[#8b5cf6] font-semibold">
            {product.category}
          </span>
          <span className="text-[10px] text-[#4b5563]">•</span>
          <span className="text-[10px] text-[#6b7280] uppercase tracking-wider">
            {product.brand}
          </span>
        </div>

        <h1 className="product-name font-[family-name:var(--font-jetbrains)] text-3xl font-bold text-[#f5f5f5] tracking-tight">
          {product.name}
        </h1>

        <ProgressRating rating={product.rating} />

        <span className="text-xs text-[#6b7280]">
          {product.reviewCount.toLocaleString()} reviews
        </span>

        <div className="item-cost font-[family-name:var(--font-jetbrains)] text-3xl font-bold text-white">
          {product.price.toFixed(0)} USD
        </div>

        <p className="product-description font-[family-name:var(--font-manrope)] text-sm text-[#9ca3af] leading-relaxed">
          {product.description}
        </p>

        <div className={`availability ${product.inStock ? "available" : "sold-out"} text-sm`}>
          {product.inStock ? (
            <span className="text-[#22c55e]">🟢 Available</span>
          ) : (
            <span className="text-[#ef4444]">🔴 Sold Out</span>
          )}
        </div>

        <Button
          className="action-btn action-btn--purchase mt-2 h-12 rounded-xl text-base font-bold tracking-wide bg-gradient-to-r from-[#8b5cf6] to-[#6366f1] hover:from-[#7c3aed] hover:to-[#4f46e5] text-white border-0 shadow-lg shadow-[#8b5cf6]/20 transition-all hover:shadow-xl hover:shadow-[#8b5cf6]/30 cursor-pointer"
          disabled={!product.inStock}
        >
          {product.inStock ? "Buy Now" : "Sold Out"}
        </Button>

        {relatedProducts.length > 0 && (
          <>
            <Separator className="my-6 bg-[#1f1f1f]" />
            <div className="also-viewed">
              <h3 className="font-[family-name:var(--font-jetbrains)] text-xs uppercase tracking-widest text-[#6b7280] mb-4 font-semibold">
                Customers also viewed
              </h3>
              <div className="grid grid-cols-2 gap-3">
                {relatedProducts.map((p) => (
                  <Link
                    key={p.id}
                    href={`/novabuy/product/${p.id}`}
                    className="group flex items-center gap-3 rounded-lg border border-[#1f1f1f] bg-[#141414] p-3 transition-all hover:border-[#8b5cf6]/30 hover:bg-[#1a1a1a]"
                  >
                    <div className="relative h-12 w-12 shrink-0 overflow-hidden rounded-md bg-[#0a0a0a]">
                      <Image
                        src={p.image}
                        alt={p.name}
                        fill
                        className="object-cover"
                        sizes="48px"
                      />
                    </div>
                    <div className="min-w-0">
                      <p className="text-xs font-medium text-[#e5e5e5] truncate group-hover:text-white transition-colors">
                        {p.name}
                      </p>
                      <p className="font-[family-name:var(--font-jetbrains)] text-[10px] text-[#8b5cf6]">
                        {p.price.toFixed(0)} USD
                      </p>
                    </div>
                  </Link>
                ))}
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

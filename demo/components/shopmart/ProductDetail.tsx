"use client";

import Image from "next/image";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import type { Product } from "@/lib/types";

function StarRating({ rating }: { rating: number }) {
  const full = Math.floor(rating);
  const half = rating % 1 >= 0.3;
  const stars = [];
  for (let i = 0; i < 5; i++) {
    if (i < full) stars.push("★");
    else if (i === full && half) stars.push("½");
    else stars.push("☆");
  }
  return (
    <span className="product-rating text-lg tracking-wide text-[#f59e0b]">
      {stars.map((s, i) => (
        <span key={i}>{s}</span>
      ))}
    </span>
  );
}

export default function ShopMartProductDetail({
  product,
}: {
  product: Product;
}) {
  return (
    <div className="product-detail mx-auto max-w-6xl px-6 py-8">
      <Link
        href="/shopmart"
        className="back-link mb-8 inline-flex items-center gap-1.5 text-sm text-[#64748b] hover:text-[#2563eb] transition-colors font-medium"
      >
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="m15 18-6-6 6-6" />
        </svg>
        Back to products
      </Link>

      <div className="product-detail__layout grid grid-cols-1 md:grid-cols-2 gap-10 items-start">
        {/* Image - Left 50% */}
        <div className="product-detail__image relative aspect-square overflow-hidden rounded-2xl bg-[#f1f5f9] shadow-sm">
          <Image
            src={product.image}
            alt={product.name}
            fill
            className="object-cover"
            sizes="50vw"
            priority
          />
        </div>

        {/* Info - Right 50% */}
        <div className="product-detail__info flex flex-col gap-5">
          <div className="flex items-center gap-3">
            <Badge
              variant="secondary"
              className="product-category bg-[#eff6ff] text-[#2563eb] text-[10px] uppercase tracking-wider font-semibold border-0 rounded-md"
            >
              {product.category}
            </Badge>
            <span className="text-xs text-[#94a3b8] uppercase tracking-wider font-medium">
              {product.brand}
            </span>
          </div>

          <h1 className="product-name font-[family-name:var(--font-instrument)] text-4xl text-[#0f172a] leading-tight">
            {product.name}
          </h1>

          <div className="flex items-center gap-3">
            <StarRating rating={product.rating} />
            <span className="text-sm text-[#64748b]">
              {product.rating} out of 5
            </span>
            <span className="text-sm text-[#94a3b8]">
              ({product.reviewCount.toLocaleString()} reviews)
            </span>
          </div>

          <div className="product-price text-3xl font-bold text-[#0f172a] tracking-tight">
            ${product.price.toFixed(2)}
          </div>

          <p className="product-description text-[15px] text-[#475569] leading-relaxed">
            {product.description}
          </p>

          <div className="flex items-center gap-3 pt-2">
            {product.inStock ? (
              <Badge className="stock-status in-stock bg-[#dcfce7] text-[#16a34a] border-0 rounded-md text-xs font-semibold uppercase tracking-wider">
                In Stock
              </Badge>
            ) : (
              <Badge className="stock-status out-of-stock bg-[#fef2f2] text-[#dc2626] border-0 rounded-md text-xs font-semibold uppercase tracking-wider">
                Out of Stock
              </Badge>
            )}
          </div>

          <Button
            className="btn btn-primary add-to-cart mt-4 h-12 rounded-xl text-base font-semibold tracking-wide bg-[#16a34a] hover:bg-[#15803d] text-white shadow-lg shadow-[#16a34a]/20 transition-all hover:shadow-xl hover:shadow-[#16a34a]/30 cursor-pointer"
            disabled={!product.inStock}
          >
            {product.inStock ? "Add to Cart" : "Out of Stock"}
          </Button>
        </div>
      </div>
    </div>
  );
}

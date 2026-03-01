import Link from "next/link";
import Image from "next/image";
import { Card, CardContent } from "@/components/ui/card";
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
    <span className="product-card__rating text-sm tracking-wide text-[#f59e0b]">
      {stars.map((s, i) => (
        <span key={i}>{s}</span>
      ))}
    </span>
  );
}

export default function ProductCard({ product }: { product: Product }) {
  return (
    <Link href={`/shopmart/product/${product.id}`} className="group">
      <Card className="product-card overflow-hidden border-[#e2e8f0] bg-white py-0 shadow-sm transition-all duration-300 hover:shadow-lg hover:-translate-y-1 hover:border-[#cbd5e1]">
        <div className="product-card__image relative aspect-[4/3] overflow-hidden bg-[#f1f5f9]">
          <Image
            src={product.image}
            alt={product.name}
            fill
            className="object-cover transition-transform duration-500 group-hover:scale-105"
            sizes="(max-width: 768px) 100vw, 33vw"
          />
          {!product.inStock && (
            <div className="absolute inset-0 flex items-center justify-center bg-black/40">
              <span className="rounded-md bg-white/90 px-3 py-1 text-xs font-semibold text-[#dc2626] uppercase tracking-wider">
                Sold Out
              </span>
            </div>
          )}
        </div>
        <CardContent className="product-card__content flex flex-col gap-2.5 p-4">
          <div className="flex items-start justify-between gap-2">
            <Badge
              variant="secondary"
              className="product-card__category bg-[#eff6ff] text-[#2563eb] text-[10px] uppercase tracking-wider font-semibold border-0 rounded-md"
            >
              {product.category}
            </Badge>
            <span className="product-card__brand text-[10px] text-[#94a3b8] uppercase tracking-wider font-medium">
              {product.brand}
            </span>
          </div>
          <h3 className="product-card__name text-[15px] font-semibold text-[#0f172a] leading-snug line-clamp-2 group-hover:text-[#2563eb] transition-colors">
            {product.name}
          </h3>
          <div className="flex items-center gap-2">
            <StarRating rating={product.rating} />
            <span className="text-[11px] text-[#94a3b8]">
              ({product.reviewCount.toLocaleString()})
            </span>
          </div>
          <div className="product-card__price text-lg font-bold text-[#0f172a] tracking-tight">
            ${product.price.toFixed(2)}
          </div>
        </CardContent>
      </Card>
    </Link>
  );
}

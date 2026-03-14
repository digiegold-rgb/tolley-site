import { prisma } from "@/lib/prisma";
import { POOL_CATEGORIES, formatPoolPrice } from "@/lib/pools";
import { PoolsAddButton } from "./pools-add-button";
import { PoolsCategoryFilter } from "./pools-category-filter";

interface PoolProduct {
  id: string;
  name: string;
  description: string | null;
  category: string | null;
  price: number;
  retailPrice: number | null;
  imageUrl: string | null;
  brand: string | null;
  unit: string | null;
  size: string | null;
  featured: boolean;
  stockStatus: string | null;
  sku: string;
  mfgPart: string | null;
  upc: string | null;
  specs: string | null;
}

export async function PoolsProducts() {
  const products: PoolProduct[] = await prisma.poolProduct.findMany({
    where: { status: "active" },
    orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
    select: {
      id: true,
      name: true,
      description: true,
      category: true,
      price: true,
      retailPrice: true,
      imageUrl: true,
      brand: true,
      unit: true,
      size: true,
      featured: true,
      stockStatus: true,
      sku: true,
      mfgPart: true,
      upc: true,
      specs: true,
    },
  });

  const categories = POOL_CATEGORIES.filter((c) =>
    products.some((p) => p.category === c)
  );

  return (
    <section id="products" className="scroll-mt-8">
      <div className="rounded-2xl bg-white p-6 shadow-lg shadow-cyan-100/50 sm:p-8">
        <h2 className="text-xl font-bold text-cyan-900">Pool Supplies</h2>
        <p className="mt-1 text-sm text-slate-500">
          Contractor pricing, delivered. Savings shown vs big-box retail.
        </p>

        {/* Category filter tabs */}
        <PoolsCategoryFilter categories={categories as string[]} />

        {/* Product grid */}
        <div
          className="pools-product-grid mt-5 grid gap-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6"
          data-products={JSON.stringify(
            products.map((p) => ({
              id: p.id,
              category: p.category,
            }))
          )}
        >
          {products.length === 0 ? (
            <p className="col-span-full py-12 text-center text-slate-400">
              Products coming soon — check back!
            </p>
          ) : (
            products.map((product) => {
              const savings =
                product.retailPrice && product.retailPrice > product.price
                  ? Math.round(product.retailPrice - product.price)
                  : null;
              const outOfStock = product.stockStatus === "out-of-stock";

              return (
                <div
                  key={product.id}
                  data-category={product.category}
                  className={`pools-card flex flex-col rounded-xl border p-3 ${
                    outOfStock
                      ? "border-slate-200 bg-slate-50 opacity-60 grayscale"
                      : "border-cyan-100 bg-cyan-50/30"
                  }`}
                >
                  {/* Product image */}
                  {product.imageUrl && (
                    <div className="mb-2 flex items-center justify-center">
                      <img
                        src={product.imageUrl}
                        alt={product.name}
                        className="h-24 w-auto object-contain"
                        loading="lazy"
                      />
                    </div>
                  )}

                  {/* Out of stock badge */}
                  {outOfStock && (
                    <span className="mb-1 inline-flex w-fit items-center rounded-full bg-slate-400 px-2 py-0.5 text-[10px] font-semibold text-white">
                      Out of Stock
                    </span>
                  )}

                  {/* Featured badge */}
                  {product.featured && !outOfStock && (
                    <span className="mb-1 inline-flex w-fit items-center rounded-full bg-cyan-600 px-2 py-0.5 text-[10px] font-semibold text-white">
                      Popular
                    </span>
                  )}

                  {/* Product info */}
                  <div className="flex-1">
                    <h3 className="text-xs font-bold leading-tight text-cyan-900">{product.name}</h3>
                    {(product.brand || product.size) && (
                      <p className="mt-0.5 text-[10px] text-slate-400">
                        {[product.brand, product.size]
                          .filter(Boolean)
                          .join(" · ")}
                      </p>
                    )}
                    {/* Part numbers */}
                    <div className="mt-1 space-y-0.5 text-[10px] text-slate-400">
                      {product.mfgPart && (
                        <p>Mfg#: <span className="font-mono text-slate-500">{product.mfgPart}</span></p>
                      )}
                      {product.upc && (
                        <p>UPC: <span className="font-mono text-slate-500">{product.upc}</span></p>
                      )}
                      <p>SKU: <span className="font-mono text-slate-500">{product.sku}</span></p>
                    </div>
                    {product.description && (
                      <p className="mt-1 line-clamp-3 text-[11px] leading-snug text-slate-600">
                        {product.description}
                      </p>
                    )}
                    {product.specs && (
                      <details className="mt-1">
                        <summary className="cursor-pointer text-[10px] font-semibold text-cyan-600 hover:text-cyan-700">
                          Specs & Safety
                        </summary>
                        <p className="mt-0.5 whitespace-pre-line text-[10px] leading-snug text-slate-500">
                          {product.specs}
                        </p>
                      </details>
                    )}
                  </div>

                  {/* Pricing */}
                  <div className="mt-2 flex items-end gap-1">
                    <span className="text-lg font-extrabold text-cyan-700">
                      {formatPoolPrice(product.price)}
                    </span>
                    {product.retailPrice && (
                      <span className="text-[10px] text-slate-400 line-through">
                        {formatPoolPrice(product.retailPrice)}
                      </span>
                    )}
                    {savings && (
                      <span className="pools-savings-badge ml-auto rounded-full bg-green-100 px-1.5 py-0.5 text-[10px] font-bold text-green-700">
                        -${savings}
                      </span>
                    )}
                  </div>

                  {/* Add to cart */}
                  <PoolsAddButton
                    productId={product.id}
                    name={product.name}
                    price={product.price}
                    imageUrl={product.imageUrl}
                    outOfStock={outOfStock}
                  />
                </div>
              );
            })
          )}
        </div>
      </div>
    </section>
  );
}

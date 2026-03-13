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
          className="pools-product-grid mt-5 grid gap-3 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4"
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

              return (
                <div
                  key={product.id}
                  data-category={product.category}
                  className="pools-card flex flex-col rounded-xl border border-cyan-100 bg-cyan-50/30 p-5"
                >
                  {/* Product image */}
                  {product.imageUrl && (
                    <div className="mb-3 flex items-center justify-center">
                      <img
                        src={product.imageUrl}
                        alt={product.name}
                        className="h-32 w-auto object-contain"
                        loading="lazy"
                      />
                    </div>
                  )}

                  {/* Featured badge */}
                  {product.featured && (
                    <span className="mb-2 inline-flex w-fit items-center rounded-full bg-cyan-600 px-2.5 py-0.5 text-xs font-semibold text-white">
                      Popular
                    </span>
                  )}

                  {/* Product info */}
                  <div className="flex-1">
                    <h3 className="text-sm font-bold text-cyan-900">{product.name}</h3>
                    {(product.brand || product.size) && (
                      <p className="mt-0.5 text-xs text-slate-400">
                        {[product.brand, product.size]
                          .filter(Boolean)
                          .join(" · ")}
                      </p>
                    )}
                    {product.description && (
                      <p className="mt-2 text-sm leading-relaxed text-slate-600">
                        {product.description}
                      </p>
                    )}
                  </div>

                  {/* Pricing */}
                  <div className="mt-4 flex items-end gap-2">
                    <span className="text-2xl font-extrabold text-cyan-700">
                      {formatPoolPrice(product.price)}
                    </span>
                    {product.retailPrice && (
                      <span className="text-sm text-slate-400 line-through">
                        {formatPoolPrice(product.retailPrice)}
                      </span>
                    )}
                    {savings && (
                      <span className="pools-savings-badge ml-auto rounded-full bg-green-100 px-2.5 py-0.5 text-xs font-bold text-green-700">
                        Save ${savings}
                      </span>
                    )}
                  </div>

                  {/* Add to cart */}
                  <PoolsAddButton
                    productId={product.id}
                    name={product.name}
                    price={product.price}
                    imageUrl={product.imageUrl}
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

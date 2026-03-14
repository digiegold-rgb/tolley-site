import { prisma } from "@/lib/prisma";
import { POOL_CATEGORIES } from "@/lib/pools";
import { PoolsProductGrid } from "./pools-product-grid";

export async function PoolsProducts() {
  const products = await prisma.poolProduct.findMany({
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
      sortOrder: true,
    },
  });

  const categories = POOL_CATEGORIES.filter((c) =>
    products.some((p) => p.category === c),
  );

  return (
    <section id="products" className="scroll-mt-8">
      <div className="rounded-2xl bg-white p-6 shadow-lg shadow-cyan-100/50 sm:p-8">
        <h2 className="text-xl font-bold text-cyan-900">Pool Supplies</h2>
        <p className="mt-1 text-sm text-slate-500">
          Contractor pricing, delivered. Savings shown vs big-box retail.
        </p>

        <PoolsProductGrid
          products={products}
          categories={categories as string[]}
        />
      </div>
    </section>
  );
}

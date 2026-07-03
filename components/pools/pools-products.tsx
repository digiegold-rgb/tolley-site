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
          Contractor pricing with free local delivery included in every price. Savings shown vs big-box retail.
        </p>
        <div className="mt-3 flex items-center gap-2 rounded-lg border border-green-200 bg-green-50 px-4 py-2.5">
          <svg className="h-5 w-5 shrink-0 text-green-600" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 18.75a1.5 1.5 0 01-3 0m3 0a1.5 1.5 0 00-3 0m3 0h6m-9 0H3.375a1.125 1.125 0 01-1.125-1.125V14.25m17.25 4.5a1.5 1.5 0 01-3 0m3 0a1.5 1.5 0 00-3 0m3 0H6.375c-.621 0-1.125-.504-1.125-1.125v-3.659a3 3 0 00-.879-2.121l-1.308-1.308a1.125 1.125 0 01-.33-.795V6.375c0-.621.504-1.125 1.125-1.125H7.5m10.5 0H21a1.125 1.125 0 011.125 1.125v2.834c0 .3-.12.586-.33.795l-1.308 1.308a3 3 0 00-.879 2.121v3.659c0 .621-.504 1.125-1.125 1.125H18" />
          </svg>
          <p className="text-sm font-semibold text-green-800">
            Every price includes free delivery to your door &mdash; no hidden shipping fees
          </p>
        </div>

        <PoolsProductGrid
          products={products}
          categories={categories as string[]}
        />
      </div>
    </section>
  );
}

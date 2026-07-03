import { notFound } from "next/navigation";
import { Metadata } from "next";
import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { formatPoolPrice, getManufacturerUrl, POOLS_BRAND } from "@/lib/pools";
import { PoolsAddButton } from "@/components/pools/pools-add-button";

interface Props {
  params: Promise<{ sku: string }>;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { sku } = await params;
  const product = await prisma.poolProduct.findUnique({
    where: { sku: decodeURIComponent(sku) },
    select: { name: true, description: true, brand: true, imageUrl: true },
  });
  if (!product) return { title: "Product Not Found" };

  return {
    title: `${product.name} — ${POOLS_BRAND}`,
    description:
      product.description?.slice(0, 160) ||
      `${product.name} from ${product.brand || POOLS_BRAND}`,
    openGraph: {
      title: product.name,
      description: product.description?.slice(0, 160) || undefined,
      images: product.imageUrl ? [product.imageUrl] : undefined,
    },
  };
}

export default async function ProductPage({ params }: Props) {
  const { sku } = await params;
  const product = await prisma.poolProduct.findUnique({
    where: { sku: decodeURIComponent(sku) },
  });

  if (!product || product.status !== "active") notFound();

  const outOfStock = product.stockStatus === "out-of-stock";
  const savings =
    product.retailPrice && product.retailPrice > product.price
      ? Math.round(product.retailPrice - product.price)
      : null;

  // Parse specs into key-value pairs
  const specLines = product.specs
    ? product.specs
        .split("\n")
        .map((l) => l.trim())
        .filter(Boolean)
    : [];

  // Parse features into bullet points
  const featureLines = product.features
    ? product.features
        .split("\n")
        .map((l) => l.trim())
        .filter(Boolean)
    : [];

  return (
    <div className="mx-auto max-w-4xl px-4 py-8">
      {/* Back link */}
      <Link
        href="/pools#products"
        className="mb-6 inline-flex items-center gap-1 text-sm text-cyan-600 hover:text-cyan-800 transition"
      >
        <svg
          className="h-4 w-4"
          fill="none"
          viewBox="0 0 24 24"
          strokeWidth={2}
          stroke="currentColor"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M15.75 19.5L8.25 12l7.5-7.5"
          />
        </svg>
        Back to Products
      </Link>

      <div className="grid gap-8 md:grid-cols-2">
        {/* Left: Image */}
        <div className="flex items-center justify-center rounded-2xl border border-cyan-100 bg-cyan-50/30 p-8">
          {product.imageUrl ? (
            <img
              src={product.imageUrl}
              alt={product.name}
              className="max-h-80 w-auto object-contain"
            />
          ) : (
            <div className="flex h-48 w-48 items-center justify-center rounded-xl bg-slate-100 text-slate-300">
              <svg
                className="h-16 w-16"
                fill="none"
                viewBox="0 0 24 24"
                strokeWidth={1}
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M2.25 15.75l5.159-5.159a2.25 2.25 0 013.182 0l5.159 5.159m-1.5-1.5l1.409-1.409a2.25 2.25 0 013.182 0l2.909 2.909M3.75 21h16.5a1.5 1.5 0 001.5-1.5V6a1.5 1.5 0 00-1.5-1.5H3.75A1.5 1.5 0 002.25 6v13.5A1.5 1.5 0 003.75 21z"
                />
              </svg>
            </div>
          )}
        </div>

        {/* Right: Details */}
        <div className="flex flex-col">
          {/* Badges */}
          <div className="flex flex-wrap gap-2">
            {outOfStock && (
              <span className="rounded-full bg-slate-400 px-3 py-1 text-xs font-semibold text-white">
                Out of Stock
              </span>
            )}
            {product.stockStatus === "low-stock" && (
              <span className="rounded-full bg-yellow-500 px-3 py-1 text-xs font-semibold text-white">
                Low Stock
              </span>
            )}
            {product.featured && !outOfStock && (
              <span className="rounded-full bg-cyan-600 px-3 py-1 text-xs font-semibold text-white">
                Popular
              </span>
            )}
            {product.category && (
              <span className="rounded-full bg-cyan-100 px-3 py-1 text-xs font-medium text-cyan-700">
                {product.category}
              </span>
            )}
          </div>

          {/* Name */}
          <h1 className="mt-3 text-2xl font-bold text-cyan-900">
            {product.name}
          </h1>

          {/* Brand / Size */}
          {(product.brand || product.size) && (
            <p className="mt-1 text-sm text-slate-500">
              {[product.brand, product.size].filter(Boolean).join(" · ")}
            </p>
          )}

          {/* Price block */}
          <div className="mt-4 flex items-baseline gap-3">
            <span className="text-3xl font-extrabold text-cyan-700">
              {formatPoolPrice(product.price)}
            </span>
            {savings && product.retailPrice && product.retailPrice > product.price && (
              <span className="text-lg text-slate-400 line-through">
                {formatPoolPrice(product.retailPrice)}
              </span>
            )}
            {savings && (
              <span className="pools-savings-badge rounded-full bg-green-100 px-3 py-1 text-sm font-bold text-green-700">
                Save ${savings}
              </span>
            )}
          </div>
          {product.unit && (
            <p className="mt-1 text-xs text-slate-400">
              per {product.unit}
            </p>
          )}
          <div className="mt-2 flex items-center gap-2 rounded-lg bg-green-50 px-3 py-2">
            <svg className="h-5 w-5 shrink-0 text-green-600" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 18.75a1.5 1.5 0 01-3 0m3 0a1.5 1.5 0 00-3 0m3 0h6m-9 0H3.375a1.125 1.125 0 01-1.125-1.125V14.25m17.25 4.5a1.5 1.5 0 01-3 0m3 0a1.5 1.5 0 00-3 0m3 0H6.375c-.621 0-1.125-.504-1.125-1.125v-3.659a3 3 0 00-.879-2.121l-1.308-1.308a1.125 1.125 0 01-.33-.795V6.375c0-.621.504-1.125 1.125-1.125H7.5m10.5 0H21a1.125 1.125 0 011.125 1.125v2.834c0 .3-.12.586-.33.795l-1.308 1.308a3 3 0 00-.879 2.121v3.659c0 .621-.504 1.125-1.125 1.125H18" />
            </svg>
            <span className="text-sm font-semibold text-green-800">
              Price includes free delivery to your door
            </span>
          </div>

          {/* Add to cart */}
          <div className="mt-5 max-w-xs">
            <PoolsAddButton
              productId={product.id}
              name={product.name}
              price={product.price}
              imageUrl={product.imageUrl}
              outOfStock={outOfStock}
            />
          </div>

          {/* Quick info pills */}
          <div className="mt-5 flex flex-wrap gap-2">
            {product.warranty && (
              <span className="rounded-lg border border-cyan-200 bg-cyan-50 px-3 py-1.5 text-xs font-medium text-cyan-700">
                Warranty: {product.warranty}
              </span>
            )}
            {product.weight && (
              <span className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-1.5 text-xs text-slate-600">
                {product.weight}
              </span>
            )}
            {product.dimensions && (
              <span className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-1.5 text-xs text-slate-600">
                {product.dimensions}
              </span>
            )}
          </div>

          {/* SDS / Safety Data Sheet */}
          {product.sdsUrl && (
            <a
              href={product.sdsUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="mt-4 inline-flex items-center gap-2 rounded-lg border border-red-200 bg-red-50 px-4 py-2.5 text-sm font-medium text-red-700 transition hover:bg-red-100"
            >
              <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m2.25 0H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z" />
              </svg>
              Safety Data Sheet (SDS)
            </a>
          )}

          {/* Part numbers */}
          <div className="mt-5 space-y-1 text-sm text-slate-500">
            {product.mfgPart && (
              <p>
                <span className="font-medium text-slate-600">Mfg #:</span>{" "}
                <a
                  href={getManufacturerUrl(product.brand, product.mfgPart)}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="font-mono text-cyan-600 underline decoration-dotted hover:text-cyan-800"
                >
                  {product.mfgPart}
                </a>
              </p>
            )}
            {product.upc && (
              <p>
                <span className="font-medium text-slate-600">UPC:</span>{" "}
                <span className="font-mono">{product.upc}</span>
              </p>
            )}
            <p>
              <span className="font-medium text-slate-600">SKU:</span>{" "}
              <span className="font-mono">{product.sku}</span>
            </p>
          </div>
        </div>
      </div>

      {/* Full Description */}
      {product.description && (
        <div className="mt-10">
          <h2 className="text-lg font-bold text-cyan-900">Description</h2>
          <p className="mt-2 whitespace-pre-line text-sm leading-relaxed text-slate-600">
            {product.description}
          </p>
        </div>
      )}

      {/* Features */}
      {featureLines.length > 0 && (
        <div className="mt-8">
          <h2 className="text-lg font-bold text-cyan-900">Features</h2>
          <ul className="mt-3 space-y-2">
            {featureLines.map((line, i) => (
              <li key={i} className="flex items-start gap-2 text-sm text-slate-600">
                <svg className="mt-0.5 h-4 w-4 shrink-0 text-cyan-500" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                </svg>
                {line}
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Specs */}
      {specLines.length > 0 && (
        <div className="mt-8">
          <h2 className="text-lg font-bold text-cyan-900">
            Specifications
          </h2>
          <div className="mt-3 overflow-hidden rounded-xl border border-cyan-100">
            {specLines.map((line, i) => {
              const colonIdx = line.indexOf(":");
              const hasKV = colonIdx > 0 && colonIdx < line.length - 1;
              return (
                <div
                  key={i}
                  className={`flex px-4 py-2.5 text-sm ${
                    i % 2 === 0 ? "bg-cyan-50/40" : "bg-white"
                  }`}
                >
                  {hasKV ? (
                    <>
                      <span className="w-48 shrink-0 font-medium text-slate-700">
                        {line.slice(0, colonIdx).trim()}
                      </span>
                      <span className="text-slate-600">
                        {line.slice(colonIdx + 1).trim()}
                      </span>
                    </>
                  ) : (
                    <span className="text-slate-600">{line}</span>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

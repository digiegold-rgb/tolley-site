export function DropshipPipeline() {
  const amazonPrice = 24.99;
  const ebayPrice = 44.99;
  const ebayFeeRate = 0.13;
  const ebayFees = +(ebayPrice * ebayFeeRate).toFixed(2);
  const profit = +(ebayPrice - amazonPrice - ebayFees).toFixed(2);
  const margin = +((profit / ebayPrice) * 100).toFixed(0);

  return (
    <section className="mx-auto max-w-4xl px-6 py-16">
      <h2 className="vater-section-title mb-3">Price Gap Pipeline</h2>
      <p className="vater-section-subtitle mb-10">
        Visual breakdown of a real arbitrage opportunity.
      </p>

      <div className="vater-card p-8">
        {/* Pipeline visual */}
        <div className="space-y-4">
          {/* Amazon cost */}
          <div>
            <div className="mb-1.5 flex items-center justify-between text-sm">
              <span className="font-semibold text-[#ff9900]">
                Amazon Buy Price
              </span>
              <span className="font-bold text-[#ff9900]">
                ${amazonPrice.toFixed(2)}
              </span>
            </div>
            <div className="vater-price-bar vater-price-amazon">
              <div
                className="h-full rounded-l-[0.5rem]"
                style={{ width: `${(amazonPrice / ebayPrice) * 100}%` }}
              />
            </div>
          </div>

          {/* Arrow connector */}
          <div className="flex items-center justify-center text-slate-500">
            <svg
              width="24"
              height="24"
              viewBox="0 0 24 24"
              fill="none"
              className="text-sky-400"
            >
              <path
                d="M12 5v14m0 0l-6-6m6 6l6-6"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          </div>

          {/* eBay sale */}
          <div>
            <div className="mb-1.5 flex items-center justify-between text-sm">
              <span className="font-semibold text-sky-400">
                eBay Sell Price
              </span>
              <span className="font-bold text-sky-400">
                ${ebayPrice.toFixed(2)}
              </span>
            </div>
            <div className="vater-price-bar vater-price-ebay">
              <div
                className="h-full rounded-l-[0.5rem]"
                style={{ width: "100%" }}
              />
            </div>
          </div>

          {/* Fees breakdown */}
          <div className="flex items-center justify-center">
            <div className="rounded-lg border border-slate-700 bg-slate-800/50 px-6 py-2 text-center text-sm">
              <span className="text-slate-400">eBay Fees (~13%):</span>{" "}
              <span className="font-bold text-red-400">
                -${ebayFees.toFixed(2)}
              </span>
            </div>
          </div>

          {/* Arrow connector */}
          <div className="flex items-center justify-center text-slate-500">
            <svg
              width="24"
              height="24"
              viewBox="0 0 24 24"
              fill="none"
              className="text-green-400"
            >
              <path
                d="M12 5v14m0 0l-6-6m6 6l6-6"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          </div>

          {/* Profit */}
          <div>
            <div className="mb-1.5 flex items-center justify-between text-sm">
              <span className="font-semibold text-green-400">
                Net Profit ({margin}% margin)
              </span>
              <span className="font-bold text-green-400">
                ${profit.toFixed(2)}
              </span>
            </div>
            <div className="vater-price-bar vater-price-profit">
              <div
                className="h-full rounded-l-[0.5rem]"
                style={{ width: `${(profit / ebayPrice) * 100}%` }}
              />
            </div>
          </div>
        </div>

        {/* Summary line */}
        <div className="mt-8 rounded-lg border border-sky-500/20 bg-sky-500/5 p-4 text-center">
          <p className="text-sm text-slate-400">
            Buy at{" "}
            <span className="font-bold text-[#ff9900]">
              ${amazonPrice.toFixed(2)}
            </span>{" "}
            &rarr; Sell at{" "}
            <span className="font-bold text-sky-400">
              ${ebayPrice.toFixed(2)}
            </span>{" "}
            &rarr; Keep{" "}
            <span className="font-bold text-green-400">
              ${profit.toFixed(2)}
            </span>{" "}
            per unit
          </p>
        </div>
      </div>
    </section>
  );
}

import { formatPoolPrice } from "@/lib/pools";

const comparisons = [
  { name: "Chlorine Tablets 25lb", retail: 129, ours: 89 },
  { name: "Pool Shock 12-Pack", retail: 59, ours: 42 },
  { name: "Variable Speed Pump 1.5HP", retail: 749, ours: 549 },
  { name: "Water Test Kit", retail: 42, ours: 28 },
  { name: "Algaecide 60 Plus", retail: 36, ours: 24 },
  { name: "Vacuum Hose 36ft", retail: 52, ours: 34 },
];

export function PoolsSavings() {
  return (
    <section className="rounded-2xl bg-white p-6 shadow-lg shadow-cyan-100/50 sm:p-8">
      <h2 className="text-xl font-bold text-cyan-900">Why Buy From Us?</h2>
      <p className="mt-2 text-sm text-slate-600">
        We buy at contractor pricing from Pool Corp — the same distributor pool
        pros use. You get those savings, delivered.
      </p>

      <div className="mt-5 overflow-x-auto">
        <table className="w-full text-left text-sm">
          <thead>
            <tr className="border-b border-cyan-100">
              <th className="pb-2 font-semibold text-cyan-900">Product</th>
              <th className="pb-2 text-right font-semibold text-slate-400">
                Retail
              </th>
              <th className="pb-2 text-right font-semibold text-cyan-700">
                Our Price
              </th>
              <th className="pb-2 text-right font-semibold text-green-600">
                You Save
              </th>
            </tr>
          </thead>
          <tbody>
            {comparisons.map((item) => {
              const savings = item.retail - item.ours;
              return (
                <tr
                  key={item.name}
                  className="border-b border-cyan-50 last:border-0"
                >
                  <td className="py-2.5 font-medium text-cyan-900">
                    {item.name}
                  </td>
                  <td className="py-2.5 text-right text-slate-400 line-through">
                    {formatPoolPrice(item.retail)}
                  </td>
                  <td className="py-2.5 text-right font-bold text-cyan-700">
                    {formatPoolPrice(item.ours)}
                  </td>
                  <td className="py-2.5 text-right font-bold text-green-600">
                    {formatPoolPrice(savings)}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <div className="mt-5 rounded-xl bg-green-50 border border-green-200 p-4 text-center">
        <p className="text-lg font-bold text-green-700">
          Save 20-40% on average
        </p>
        <p className="mt-1 text-sm text-green-600">
          vs Walmart, Leslie&apos;s, and other big-box retailers. Delivery
          included.
        </p>
      </div>
    </section>
  );
}

import { TBL_TABLES } from "@/lib/tables";

export function TablesInventory() {
  return (
    <section className="rounded-xl border border-slate-700/50 bg-[#0c1e14] p-6 sm:p-8">
      <h2 className="tbl-neon-text text-2xl font-black tracking-wide text-[#c8a84e] uppercase sm:text-3xl">
        What We Have
      </h2>
      <p className="mt-2 text-sm font-light text-slate-400">
        All tables and chairs are folding — easy to set up and break down.
      </p>

      <div className="mt-6 grid gap-4 sm:grid-cols-2">
        {TBL_TABLES.map((item) => (
          <div
            key={item.name}
            className="tbl-card flex items-center gap-4 rounded-lg border border-slate-700/50 bg-[#0a1a12] p-5"
          >
            <div className="flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-lg bg-[#c8a84e]/10 text-2xl">
              <svg className="h-7 w-7 text-[#c8a84e]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 6A2.25 2.25 0 016 3.75h2.25A2.25 2.25 0 0110.5 6v2.25a2.25 2.25 0 01-2.25 2.25H6a2.25 2.25 0 01-2.25-2.25V6zM3.75 15.75A2.25 2.25 0 016 13.5h2.25a2.25 2.25 0 012.25 2.25V18a2.25 2.25 0 01-2.25 2.25H6A2.25 2.25 0 013.75 18v-2.25zM13.5 6a2.25 2.25 0 012.25-2.25H18A2.25 2.25 0 0120.25 6v2.25A2.25 2.25 0 0118 10.5h-2.25a2.25 2.25 0 01-2.25-2.25V6zM13.5 15.75a2.25 2.25 0 012.25-2.25H18a2.25 2.25 0 012.25 2.25V18A2.25 2.25 0 0118 20.25h-2.25A2.25 2.25 0 0113.5 18v-2.25z" />
              </svg>
            </div>
            <div>
              <div className="flex items-baseline gap-2">
                <h3 className="font-black tracking-wide text-white uppercase">{item.name}</h3>
                {item.qty > 1 && (
                  <span className="text-xs font-bold text-[#c8a84e]/60">×{item.qty}</span>
                )}
              </div>
              <p className="text-xs font-light text-slate-500">{item.dimensions}</p>
              <p className="mt-1 text-sm font-bold text-[#c8a84e]">${item.price}/day</p>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}

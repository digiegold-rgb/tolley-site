import { WD_FAQ } from "@/lib/wd";


export function WdFaq() {
  return (
    <section>
      <h2 className="text-xl font-bold text-blue-900 sm:text-2xl">FAQ</h2>
      <div className="mt-5 grid gap-4 sm:grid-cols-2">
        {WD_FAQ.map((item) => (
          <div
            key={item.q}
            className="wd-card rounded-2xl border border-blue-100 bg-white p-6 shadow-sm shadow-blue-100/40"
          >
            <h3 className="text-base font-bold text-blue-900">{item.q}</h3>
            <p className="mt-2 text-sm leading-relaxed text-slate-600">
              {item.a}
            </p>
          </div>
        ))}
      </div>
    </section>
  );
}

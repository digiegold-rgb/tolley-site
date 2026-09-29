"use client";
import { useState } from "react";
import { resaleMath } from "@/lib/growth/core";
export default function Calculators() {
  const [values, setValues] = useState([40, 15, 0, 0, 0, 10, 1]);
  const result = resaleMath(values[0],values[1],values[2],values[3],values[4],values[5],values[6]);
  const labels = ["Expected resale price ($)","Acquisition cost incl. shipping/tax ($)","Your selling fee estimate (%)","Fixed selling costs per sale ($)","Packing, shipping, returns & labor allowance ($)","Desired profit ($)","Units in your purchased lot"];
  const money = (n: number) => n.toLocaleString("en-US", { style: "currency", currency: "USD" });
  return <section className="rounded-xl border p-5 space-y-4"><h2 className="text-2xl">Resale planning tools</h2><p>For profit and maximum bid, enter costs for one sale. For lot cost, divide the acquisition cost by the number of units.</p><div className="grid gap-4 sm:grid-cols-2">{labels.map((l,i) => <label key={l}>{l}<input className="block w-full rounded border p-2 bg-transparent" type="number" min={i === 6 ? 1 : 0} step={i === 6 ? 1 : .01} value={values[i]} onChange={e => setValues(values.map((v,j) => j === i ? e.target.value === "" ? NaN : Number(e.target.value) : v))}/></label>)}</div><div aria-live="polite">{result ? <><p>Estimated profit: {money(result.profit)}</p><p>Maximum acquisition cost for your desired profit: {money(result.maximumBuy)}</p><p>Break-even resale price: {money(result.breakEvenSale)}</p><p>Lot acquisition cost per unit: {money(result.unitCost)}</p></> : <p>Enter valid nonnegative amounts, fees below 100%, and at least one whole unit.</p>}</div></section>;
}

import Link from "next/link";
import { publicOfferings } from "@/lib/discovery";
export const metadata = {
  title: "Tolley Services, Rentals, Real Estate & Creative Tools",
  description: "Explore Tolley’s Kansas City services, rental equipment, real estate help, local shopping, and online video tools. Contact each provider directly.",
  alternates: { canonical: "https://www.tolley.io/services" },
};
export default function ServicesPage() {
  return <main className="min-h-screen bg-neutral-950 px-6 py-16 text-white"><div className="mx-auto max-w-5xl">
    <h1 className="text-4xl font-bold">Services, rentals & creative tools</h1>
    <p className="my-6 text-lg text-neutral-300">Find help for your property, equipment for your next job, something for your home, or tools for your next video. Each offering has its own details and next steps.</p>
    <div className="grid gap-6 md:grid-cols-2">{publicOfferings().map(s => <article key={s.name} className="rounded-xl border border-neutral-700 p-6">
      <h2 className="text-xl font-semibold"><Link className="underline" href={s.url}>{s.title}</Link></h2>
      <p className="my-3 text-neutral-300">{s.purpose}</p>
      {s.serviceArea && <p className="text-sm">{s.serviceArea}</p>}
      {s.discovery?.phone && <a className="mt-3 inline-block underline" href={`tel:+1${s.discovery.phone.replace(/\D/g, "")}`}>{s.discovery.phone}</a>}
    </article>)}</div>
    <p className="mt-8"><Link href="/live" className="underline">Watch Treasure Hauls live on Whatnot</Link></p>
  </div></main>;
}

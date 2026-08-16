import Link from "next/link";

export default function FitDisclosure() {
  return (
    <p className="mt-8 rounded-xl border border-white/10 bg-white/[0.03] px-4 py-3 text-xs leading-relaxed text-white/55">
      <strong className="text-white/75">#ad · Affiliate disclosure.</strong> As an Amazon Associate we earn from
      qualifying purchases. Ruthann is our animated brand host — her outfits are styled digitally, and each piece
      here is a real product we picked to match the look, not the exact garment in the video. Prices and availability
      are on Amazon.{" "}
      <Link href="/shop/disclosure" className="underline decoration-white/30 underline-offset-2 hover:text-white">
        Full disclosure
      </Link>
    </p>
  );
}

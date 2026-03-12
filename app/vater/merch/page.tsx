import { MerchHero } from "@/components/vater/merch-hero";
import { MerchWorkflow } from "@/components/vater/merch-workflow";
import { MerchPlatforms } from "@/components/vater/merch-platforms";
import { MerchSetup } from "@/components/vater/merch-setup";
import { MerchFaq } from "@/components/vater/merch-faq";

export const metadata = {
  title: "Merch — Print-on-Demand Empire | Vater Ventures",
  description:
    "AI-generated designs on Etsy, fulfilled by Printful. Zero inventory, zero shipping — pure print-on-demand profit.",
};

export default function MerchPage() {
  return (
    <main>
      <MerchHero />

      <div className="mx-auto max-w-4xl px-6 py-16">
        <MerchWorkflow />
      </div>

      <div className="mx-auto max-w-4xl px-6 py-16">
        <MerchPlatforms />
      </div>

      <div className="mx-auto max-w-4xl px-6 py-16">
        <MerchSetup />
      </div>

      <div className="mx-auto max-w-4xl px-6 py-16">
        <MerchFaq />
      </div>
    </main>
  );
}

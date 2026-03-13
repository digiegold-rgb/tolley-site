import { PoolsHero } from "@/components/pools/pools-hero";
import { PoolsHowItWorks } from "@/components/pools/pools-how-it-works";
import { PoolsProducts } from "@/components/pools/pools-products";
import { PoolsSavings } from "@/components/pools/pools-savings";
import { PoolsServiceArea } from "@/components/pools/pools-service-area";
import { PoolsFaq } from "@/components/pools/pools-faq";
import { PoolsCartProvider } from "@/components/pools/pools-cart-provider";
import { PoolsCartDrawer } from "@/components/pools/pools-cart-drawer";

export const revalidate = 30;

export default function PoolsPage() {
  return (
    <PoolsCartProvider>
      <main className="relative z-10 min-h-screen">
        <PoolsHero />

        <div className="mx-auto max-w-6xl space-y-8 px-5 py-12 sm:px-8 sm:py-16">
          <div className="pools-enter" style={{ "--enter-delay": "0.1s" } as React.CSSProperties}>
            <PoolsHowItWorks />
          </div>
          <div className="pools-enter" style={{ "--enter-delay": "0.2s" } as React.CSSProperties}>
            <PoolsProducts />
          </div>
          <div className="pools-enter" style={{ "--enter-delay": "0.3s" } as React.CSSProperties}>
            <PoolsSavings />
          </div>
          <div className="pools-enter" style={{ "--enter-delay": "0.4s" } as React.CSSProperties}>
            <PoolsServiceArea />
          </div>
          <div className="pools-enter" style={{ "--enter-delay": "0.5s" } as React.CSSProperties}>
            <PoolsFaq />
          </div>
        </div>

        <PoolsCartDrawer />
      </main>
    </PoolsCartProvider>
  );
}

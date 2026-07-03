import { CrazyHero } from "@/components/crazybins/CrazyHero";
import { CrazyMarquee } from "@/components/crazybins/CrazyMarquee";
import { CrazyDailyLadder } from "@/components/crazybins/CrazyDailyLadder";
import { CrazyCategories } from "@/components/crazybins/CrazyCategories";
import { CrazyMap } from "@/components/crazybins/CrazyMap";
import { CrazyGallery } from "@/components/crazybins/CrazyGallery";
import { CrazyTestimonials } from "@/components/crazybins/CrazyTestimonials";
import { CrazyFollowFB } from "@/components/crazybins/CrazyFollowFB";
import { CrazyFooter } from "@/components/crazybins/CrazyFooter";
import { CrazyAddressBar } from "@/components/crazybins/CrazyAddressBar";

export const revalidate = 3600;

const jsonLd = {
  "@context": "https://schema.org",
  "@type": "Store",
  name: "Crazy Bin Store #2",
  image: "https://www.tolley.io/crazybins/photos/cover.jpg",
  description:
    "Liquidation/bin store in Independence, MO. Electronics, kids toys, home appliances, mobile accessories, cosmetics, office supplies, furniture — 60–80% off retail. Different deal every day.",
  url: "https://www.tolley.io/crazybins",
  address: {
    "@type": "PostalAddress",
    streetAddress: "4452 South Noland Road",
    addressLocality: "Independence",
    addressRegion: "MO",
    postalCode: "64055",
    addressCountry: "US",
  },
  geo: { "@type": "GeoCoordinates", latitude: 39.041667, longitude: -94.366111 },
  openingHours: ["Mo-We 10:00-18:30", "Fr-Su 10:00-18:30"],
  sameAs: ["https://www.facebook.com/CrazyBinStoreIndependence"],
  aggregateRating: {
    "@type": "AggregateRating",
    ratingValue: "4.5",
    bestRating: "5",
    reviewCount: "8",
  },
};

export default function CrazyBinsPage() {
  return (
    <main className="min-h-screen pb-24 lg:pb-0">
      <script type="application/ld+json">{JSON.stringify(jsonLd)}</script>
      <CrazyHero />
      <CrazyMarquee />
      <CrazyDailyLadder />
      <CrazyCategories />
      <CrazyMap />
      <CrazyGallery />
      <CrazyTestimonials />
      <CrazyFollowFB />
      <CrazyFooter />
      <CrazyAddressBar />
    </main>
  );
}

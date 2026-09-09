import { permanentRedirect } from "next/navigation";
import { routeDestination, type RouteSearchParams } from "@/lib/public-route-policy";

export default async function RetiredPage({ searchParams }: { searchParams: Promise<RouteSearchParams> }) {
  permanentRedirect(routeDestination("/agent#demo", await searchParams));
}

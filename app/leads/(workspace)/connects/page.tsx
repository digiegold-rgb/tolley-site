import { redirect } from "next/navigation";
import { routeDestination, type RouteSearchParams } from "@/lib/public-route-policy";

export default async function RetiredPage({ searchParams }: { searchParams: Promise<RouteSearchParams> }) {
  redirect(routeDestination("/leads/dashboard", await searchParams));
}

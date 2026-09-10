import { permanentRedirect } from "next/navigation";
import { legacyToolDestination } from "@/lib/leads/owner-tools";

export default async function LegacyPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  permanentRedirect(legacyToolDestination("trends", await searchParams));
}

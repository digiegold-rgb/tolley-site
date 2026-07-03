import { auth } from "@/auth";
import { redirect } from "next/navigation";
import ShowingsCalendar from "@/components/leads/ShowingsCalendar";

export default async function ShowingsPage() {
  const session = await auth();
  if (!session?.user?.id) redirect("/login?callbackUrl=/leads/showings");

  return <ShowingsCalendar />;
}

import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { auth } from "@/auth";
import { isAdminEmail } from "@/lib/admin-auth";
import { readPersonalUsePlan } from "@/lib/leads/personal-use-plan";

export const dynamic = "force-dynamic";
export const metadata = { title: "Owner personal-use plan | T-Agent", robots: { index: false, follow: false } };

export default async function OwnerPlanPage() {
  const session = await auth();
  if (session?.mfaRequired) redirect("/login/mfa-challenge?callbackUrl=%2Fleads%2Fguide%2Fowner");
  if (!session?.user?.id) redirect("/login?callbackUrl=%2Fleads%2Fguide%2Fowner");
  if (!isAdminEmail(session.user.email)) notFound();
  const plan = await readPersonalUsePlan();

  return <div className="mx-auto max-w-3xl pb-12">
    <nav aria-label="Plan actions" className="mb-6 flex flex-wrap gap-5 text-sm text-teal-200">
      <Link href="/leads/guide" className="underline">First-week guide</Link>
      <Link href="/leads#capture" className="underline">Save a follow-up</Link>
      <a href="/api/leads/guide/plan" download className="underline">Download original .md</a>
    </nav>
    <p className="mb-6 rounded-xl border border-white/15 p-4 text-sm text-white/65">Owner document · September 9, 2026. This is the original investigation and plan; its dated findings and release status are a snapshot from that day.</p>
    <article className="break-words text-white/75 [&_h1]:mb-5 [&_h1]:text-3xl [&_h1]:font-semibold [&_h1]:text-white [&_h2]:mb-3 [&_h2]:mt-8 [&_h2]:text-xl [&_h2]:font-semibold [&_h2]:text-white [&_p]:my-4 [&_p]:leading-7 [&_ul]:list-disc [&_ul]:pl-6 [&_ol]:list-decimal [&_ol]:pl-6 [&_li]:my-2 [&_li]:leading-7 [&_a]:text-teal-200 [&_a]:underline [&_code]:rounded [&_code]:bg-white/10 [&_code]:px-1 [&_code]:text-sm [&_strong]:text-white">
      <ReactMarkdown remarkPlugins={[remarkGfm]} skipHtml>{plan}</ReactMarkdown>
    </article>
  </div>;
}

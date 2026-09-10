import Link from "next/link";
import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { isAdminEmail } from "@/lib/admin-auth";

export const dynamic = "force-dynamic";
export const metadata = { title: "Your first week | T-Agent", robots: { index: false, follow: false } };

const steps = [
  { title: "Save one person and one promise", body: "Start with someone who asked for help, a current customer, or a referral partner. Save their contact details and a specific next step, such as ‘Confirm the walkthrough time.’", href: "/leads#capture", action: "Save a follow-up" },
  { title: "Make room for a 15-minute morning", body: "Open Today and work the next due promise. Read your note, then use the phone or email link to contact the person. Start with three follow-ups; check other urgent promises before stopping.", href: "/leads", action: "Open Today" },
  { title: "Record what actually happened", body: "Open ‘Record what happened’ on the follow-up. Log an attempt, conversation, appointment, or finished task. If work remains, save the next step and time. Choose ‘Do this later’ to reschedule.", href: "/leads", action: "Work your next follow-up" },
];

export default async function FirstWeekPage() {
  const session = await auth();
  if (session?.mfaRequired) redirect("/login/mfa-challenge?callbackUrl=%2Fleads%2Fguide");
  if (!session?.user?.id) redirect("/login?callbackUrl=%2Fleads%2Fguide");
  const owner = isAdminEmail(session.user.email);

  return <div className="mx-auto max-w-3xl space-y-8 pb-12">
    <header>
      <p className="text-sm text-teal-200">T-Agent · First week</p>
      <h1 className="mt-2 text-3xl font-semibold sm:text-4xl">Keep the promises that bring work back.</h1>
      <p className="mt-4 text-white/70">Try one small daily routine for seven days. Start with people you know and requests you already have. Let your actual results tell you whether T-Agent earns a place in your day.</p>
      <Link href="/leads#capture" className="mt-5 inline-flex rounded-xl bg-teal-300 px-5 py-3 font-semibold text-slate-950">Start with one real person</Link>
    </header>

    <ol className="space-y-4">
      {steps.map((step, index) => <li key={step.title} className="rounded-2xl border border-white/15 p-5 sm:p-6">
        <p className="text-sm text-teal-200">Step {index + 1}</p>
        <h2 className="mt-1 text-xl font-semibold">{step.title}</h2>
        <p className="mt-3 text-sm leading-6 text-white/70">{step.body}</p>
        <Link href={step.href} className="mt-4 inline-block text-sm text-teal-200 underline underline-offset-4">{step.action}</Link>
      </li>)}
    </ol>

    <section className="rounded-2xl border border-white/15 p-6">
      <h2 className="text-xl font-semibold">Nothing in Today yet?</h2>
      <p className="mt-3 text-sm leading-6 text-white/70">Bring a requested quote, an estate walkthrough, a customer check-in, or a referral you promised to return. Add a person once; use their next follow-up to keep the relationship moving. Existing contacts suggested on Today have an “Add follow-up” button.</p>
      <div className="mt-4 flex flex-wrap gap-5 text-sm">
        <Link href="/leads/clients" className="text-teal-200 underline">Review your contacts</Link>
        {owner && <Link href="/hq?tab=inbound" className="text-teal-200 underline">Review website requests in HQ</Link>}
      </div>
      {owner && <p className="mt-3 text-sm text-white/60">On Today, “Requests from your sites” lets you add a new inquiry to your follow-ups. If your workspace is not active yet, open Today and choose “Open my owner workspace.”</p>}
    </section>

    <section id="week-review" className="scroll-mt-24 space-y-4">
      <h2 className="text-2xl font-semibold">After seven days, judge the difference.</h2>
      <p className="text-sm leading-6 text-white/70">Aim to open Today on five of seven days. At the end of the week, look for one forgotten follow-up you recovered and one useful conversation or appointment you can describe.</p>
      <ul className="list-disc space-y-2 pl-5 text-sm leading-6 text-white/70">
        <li>What would you have forgotten or delayed without it?</li>
        <li>Was saving a person and logging the result easy enough to keep doing?</li>
        <li>Did any follow-up lead to paid work? Check the contact, deal, and actual payment evidence.</li>
      </ul>
      <p className="text-sm text-white/60">Today shows the activity you log. Conversations and appointments help you review effort; they do not prove revenue. If you keep working elsewhere, identify that task and simplify the routine around it.</p>
      <div className="flex flex-wrap gap-5 text-sm">
        <Link href="/leads#week-review" className="text-teal-200 underline">Review your week in Today</Link>
        <Link href="/leads/deals" className="text-teal-200 underline">Review deals</Link>
      </div>
    </section>

    <section className="border-t border-white/15 pt-6 text-sm leading-6 text-white/65">
      <h2 className="font-semibold text-white">When you need new prospects</h2>
      <p className="mt-2">Check the service area, source date, property match, and living contact before treating a research result as someone to call. A score alone cannot establish that a person needs help.</p>
      <Link href="/leads/overview" className="mt-3 inline-block text-teal-200 underline">Open research &amp; tools</Link>
    </section>

    {owner && <aside className="rounded-2xl border border-white/15 p-5">
      <h2 className="font-semibold">Your original personal-use plan</h2>
      <p className="mt-2 text-sm text-white/65">The full September 9 investigation, first-week test, and seller-research repair plan are saved here for your owner account.</p>
      <div className="mt-4 flex flex-wrap gap-5 text-sm">
        <Link href="/leads/guide/owner" className="text-teal-200 underline">Read the full plan</Link>
        <a href="/api/leads/guide/plan" download className="text-teal-200 underline">Download original .md</a>
      </div>
    </aside>}
  </div>;
}

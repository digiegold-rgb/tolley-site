import { NEWDAD_COURSE } from "@/lib/vater";
import { EmailCaptureForm } from "@/components/tools/EmailCaptureForm";

// The course itself hasn't shipped — the old "Get the Course" button was a
// dead href="#" (CTO audit 2026-07-06). Capture demand instead; leads land in
// the /hq Inbox via /api/email-capture.
export function CourseNewdadCta() {
  return (
    <section className="relative z-10 mx-auto max-w-4xl px-6 py-16">
      <div className="vater-card flex flex-col items-center p-10 text-center">
        <span className="mb-4 text-5xl" role="img" aria-label="Baby">
          {NEWDAD_COURSE.icon}
        </span>

        <h2 className="vater-neon text-3xl font-bold tracking-wide sm:text-4xl">
          Ready to Crush Fatherhood?
        </h2>

        <p className="mt-4 max-w-lg text-lg text-slate-400">
          The no-BS playbook from a dad who survived it &mdash; delivery room
          to toddler tantrums, every stage covered.
        </p>

        <div className="mt-6 flex items-baseline gap-2">
          <span className="text-4xl font-bold text-amber-400">
            ${NEWDAD_COURSE.price}
          </span>
          <span className="text-slate-400">
            founding price &mdash; locked in for the waitlist
          </span>
        </div>

        <EmailCaptureForm
          source="vater-course-newdad"
          ctaText="Join the Waitlist"
          successMessage="You're on the list — founding price locked in."
          className="mt-8 w-full max-w-md"
        />

        <p className="mt-6 text-sm text-slate-500">
          Launching soon. Waitlist members get first access at the founding
          price.
        </p>
      </div>
    </section>
  );
}

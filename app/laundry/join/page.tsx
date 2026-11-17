import Link from "next/link";
import { auth } from "@/auth";
import { OperatorForm } from "@/components/laundry/operator-form";
export const metadata = { title: "List your rental business for free" };
export default async function Page() {
  const session = await auth();
  return (
    <div className="wrap page">
      <p className="eyebrow">Independent operators. A bigger neighborhood.</p>
      <h1>
        Your business.
        <br />
        More doors to deliver to.
      </h1>
      <p>
        Free listing. $45 per confirmed booking. No cut of monthly rent, no
        territory fee, and no minimum. Decline any request that does not fit.
      </p>
      <div className="strip">
        <span>01 · Apply</span>
        <span>02 · Save a card</span>
        <span>03 · Get approved</span>
        <span>04 · Book your first renter</span>
      </div>
      <div style={{ marginTop: 30 }}>
        {session?.user?.id && !session.mfaRequired ? (
          <OperatorForm />
        ) : (
          <div className="card">
            <h2>Start with your operator account.</h2>
            <p>
              Sign in or create an account to save your application and manage
              your own leads.
            </p>
            <Link
              className="button"
              href="/login?callbackUrl=%2Flaundry%2Fjoin"
            >
              Sign in or create an account ↗
            </Link>
          </div>
        )}
      </div>
    </div>
  );
}

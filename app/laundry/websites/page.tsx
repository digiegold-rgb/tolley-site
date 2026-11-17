import Link from "next/link";
export const metadata = { title: "Websites for local rental operators" };
export default function Page() {
  return (
    <div className="wrap page">
      <p className="eyebrow">Your business, on your own domain</p>
      <h1>
        A local rental business
        <br />
        deserves a useful website.
      </h1>
      <p>
        Give renters your prices, service area, equipment and a clear way to
        request delivery. We can build from the existing Tolley operator
        templates and connect your intake workflow.
      </p>
      <div className="grid">
        <div className="card">
          <h3>Your own identity</h3>
          <p>Your business name, photos, domain and rental terms.</p>
        </div>
        <div className="card">
          <h3>Built for local search</h3>
          <p>
            Useful service-area pages grounded in the places you actually
            deliver.
          </p>
        </div>
        <div className="card">
          <h3>A working next step</h3>
          <p>A request form that saves inquiries and helps you follow up.</p>
        </div>
      </div>
      <p>
        Website setup and ongoing hosting are quoted separately. A website
        purchase is never required to list in the directory. Independently
        acquired website customers do not incur a marketplace booking fee.
      </p>
      <Link className="button" href="/laundry/join">
        Apply and request a website quote ↗
      </Link>
    </div>
  );
}

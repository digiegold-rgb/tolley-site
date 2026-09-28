import { WD_CONTACT_EMAIL, WD_CONTACT_PHONE } from "@/lib/wd";
import { WD_SERVICE_CITY_LABELS } from "@/lib/wd-service-zips";

export function WdServiceArea() {
  return (
    <section className="rounded-2xl bg-white p-6 shadow-lg shadow-blue-100/50 sm:p-8">
      <h2 className="text-xl font-bold text-blue-900">Service Area</h2>
      <p className="mt-2 text-sm text-slate-600">
        We deliver and service within about <strong>25 minutes of Independence, MO 64052</strong>.
      </p>
      <div className="mt-4 flex flex-wrap gap-2">
        {WD_SERVICE_CITY_LABELS.map((city) => (
          <span
            key={city}
            className="rounded-full bg-blue-100 px-4 py-1.5 text-sm font-medium text-blue-700"
          >
            {city}
          </span>
        ))}
      </div>
      <p className="mt-5 text-sm text-slate-500">
        Don&apos;t see your area? Leave your number on the quote form and we&apos;ll reach out if that changes, or call{" "}
        <a
          href={`tel:${WD_CONTACT_PHONE}`}
          data-track-event="phone_click"
          data-track-label="service_area"
          className="font-semibold text-blue-600 underline decoration-blue-300 underline-offset-4 transition hover:text-blue-800"
        >
          {WD_CONTACT_PHONE}
        </a>
        {" "}or{" "}
        <a
          href={`mailto:${WD_CONTACT_EMAIL}`}
          data-track-event="email_click"
          data-track-label="service_area"
          className="font-semibold text-blue-600 underline decoration-blue-300 underline-offset-4 transition hover:text-blue-800"
        >
          email us
        </a>
        .
      </p>
    </section>
  );
}

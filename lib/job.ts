import { WD_CONTACT_PHONE } from "./wd";

export const JOB = {
  title: "Part-Time Helper — $28/hr, Paid Daily, Truck Provided",
  description: "Part-time washer and dryer delivery helper in Independence, MO. $28/hr, paid daily. About 10 hours a week to start. Must live within about 1 mile of Three Trails Elementary and be available on short notice.",
  phone: WD_CONTACT_PHONE,
  smsPhone: `+1${WD_CONTACT_PHONE.replace(/\D/g, "")}`,
  location: "Within about 1 mile of Three Trails Elementary in Independence, MO",
  duties: [
    "Deliver and hook up washer & dryer sets",
    "Pick up returns and haul units to scrap",
    "Hand out flyers and knock doors at nearby apartments",
  ],
  equipment: "Truck and trailer, gas, dolly, straps, ramps, winch, and all tools.",
  requirements: ["Valid driver’s license", "Can move heavy appliances with a dolly", "Has a phone", "Reliable and available on short notice"],
} as const;

export type JobApplication = { name: string; phone: string; crossStreets: string; availability: string; why: string };

export function jobApplicationText(fields: JobApplication) {
  return ["Part-Time Helper application — tolley.io/job", `Name: ${fields.name.trim()}`, `Phone: ${fields.phone.trim()}`, `Nearest cross streets: ${fields.crossStreets.trim()}`, `Availability: ${fields.availability.trim()}`, `Why me: ${fields.why.trim()}`].join("\n");
}

export function jobSmsHref(message: string, appleDevice: boolean) {
  return `sms:${JOB.smsPhone}${appleDevice ? "&" : "?"}body=${encodeURIComponent(message)}`;
}

// Tolley Cleanouts — estate/rental/garage cleanouts in the KC metro.
// Angle: one call — we clear the unit, broom-clean it, haul everything, and
// anything with resale value comes off the bill. Free-quote model, no public
// price list. Resale inventory flows into /shop via the CLEANOUT-INTAKE
// playbook (~/business-os/03-PLAYBOOKS/CLEANOUT-INTAKE.md).

// Cordless's business line — same constant value used by lib/wd.ts,
// lib/rental.ts, lib/demo-site.ts, etc.
export const TC_PHONE = "913-283-3826";
export const TC_PHONE_TEL = "tel:+19132833826";
export const TC_PHONE_SMS = "sms:+19132833826";

export const TC_AREA = "Kansas City Metro";

export interface TcStep {
  num: string;
  title: string;
  desc: string;
}

export const TC_STEPS: TcStep[] = [
  {
    num: "1",
    title: "Text us photos or book a walkthrough",
    desc: "Snap a few pictures of the unit, garage, or house and text them over. Big or complicated job? We'll come walk it with you — free either way.",
  },
  {
    num: "2",
    title: "We quote flat, no surprises",
    desc: "One number for the whole job. Anything with resale value we spot gets credited against that number before you ever say yes.",
  },
  {
    num: "3",
    title: "We clear it, broom-clean, haul everything",
    desc: "One visit. Furniture, appliances, boxes, trash — all of it gone, floors swept, unit ready for paint, carpet, or keys.",
  },
];

export interface TcService {
  title: string;
  desc: string;
}

export const TC_SERVICES: TcService[] = [
  {
    title: "Estate cleanouts",
    desc: "Full-house clearing handled respectfully, with before/after photos. Resale value comes off the bill, usable goods get donated.",
  },
  {
    title: "Rental turnovers",
    desc: "Tenant left it full? We clear and broom-clean in one visit so your crew can get straight to paint and carpet.",
  },
  {
    title: "Garage & basement",
    desc: "Decades of accumulation out in an afternoon. Keep what you want — we haul the rest.",
  },
  {
    title: "Storage units",
    desc: "Abandoned or auction units cleared to bare walls, fast, so you stop paying (or start re-renting) the space.",
  },
  {
    title: "Hoarding-scale jobs",
    desc: "No judgment, no shortcuts. We've cleared the heavy ones — quoted after a free walkthrough so there are no surprises.",
  },
  {
    title: "Appliance haul-away",
    desc: "Washers, dryers, fridges, stoves — dead or alive. Working units are exactly the kind of resale credit that shrinks your bill.",
  },
];

export interface TcFaq {
  q: string;
  a: string;
}

export const TC_FAQ: TcFaq[] = [
  {
    q: "How fast can you get out here?",
    a: "Usually within 2–3 days, and rental turnovers often same-week. Fastest path: text photos to 913-283-3826 and you'll have a quote back the same day.",
  },
  {
    q: "What do you take?",
    a: "Just about everything in the unit — furniture, appliances, boxes, clothes, tools, mattresses, general junk. The only exceptions are hazardous materials like paint, chemicals, and asbestos, and we'll point you to the right disposal for those.",
  },
  {
    q: "How does pricing work?",
    a: "Free quote, one flat number for the whole job based on volume and access. Before you commit, anything with resale value gets credited against that number — so the quote you approve is the most you'll pay.",
  },
  {
    q: "Do I need to be there?",
    a: "No. A lockbox code, a key under the mat, or a property manager letting us in is plenty. We send before/after photos when the job's done.",
  },
  {
    q: "What happens to all the stuff?",
    a: "Three buckets: items with resale value get resold (that's your discount), usable goods get donated where it makes sense, and the rest gets hauled off and disposed of properly.",
  },
];

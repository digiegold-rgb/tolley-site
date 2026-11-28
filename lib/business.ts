/** Shared public offer. Pricing and delivery are agreed per project. */
export const BUSINESS_URL = "https://www.tolley.io/business";
export const BUSINESS_TITLE = "Custom Business Software & Workflow Automation | Tolley";
export const BUSINESS_EMAIL = "support@tolley.io";
export const BUSINESS_AREA = "Worldwide · remote collaboration";
export const BUSINESS_DESCRIPTION = "Custom business software and workflow automation by Jared Tolley. Turn manual job paperwork, inventory, orders, and billing into connected systems. Work directly with the builder, remotely from anywhere in the world.";
export const BUSINESS_PRICING = "Projects are quoted individually. Scope, deliverables, timing, software costs, and any ongoing support are agreed before work begins. Sending an inquiry is free and does not commit you to a project.";

export const BUSINESS_WORKFLOWS = [
  { id: "paperwork", title: "Job paperwork to invoices", audience: "Delivery & field-service businesses", before: "Delivery slips, completion photos, and messages need to be retyped before you can bill.", input: "Job photos + delivery slips", review: "Check extracted job details", output: "Reviewed invoice draft", outcome: "Keep the job record, missing details, and billing status together. Review the draft before it goes to your customer." },
  { id: "inventory", title: "Photos to organized inventory", audience: "Resellers & estate-sale operators", before: "You have photos on a phone, condition notes in your head, and a spreadsheet that is always behind.", input: "Photos + condition notes", review: "Confirm item, condition & location", output: "Inventory + listing draft", outcome: "Give each item a record, a storage location, and an editable description. Marketplace connections are scoped and checked individually." },
  { id: "orders", title: "Orders to completed work", audience: "Rental & service businesses", before: "Requests arrive in different places. Keeping track of who needs what takes another round of messages.", input: "Customer request + order details", review: "Confirm availability & next step", output: "Job board + payment status", outcome: "Bring the request, assigned equipment or work, and completion record into one view. Keep people in control of commitments." },
] as const;

export const BUSINESS_FAQ = [
  { q: "Can we work together outside Kansas City or the United States?", a: "Yes. Custom software and workflow automation are offered remotely worldwide. Share your country and time zone so we can agree how to communicate and review the work. We confirm tool access, project fit, and any location-specific requirements before starting." },
  { q: "What kinds of businesses are a good fit?", a: "Owner-operated businesses and small teams with recurring manual work, especially businesses that move, sell, rent, or service physical things. Examples include delivery companies, resellers, estate-sale operators, equipment rentals, and field-service businesses. Other businesses are welcome to describe a similar workflow." },
  { q: "What can you build?", a: "Custom internal tools, customer portals, inventory and job tracking, document-to-record workflows, invoice preparation, and connections between existing software. AI can assist with extraction or drafts when useful, with review steps for important decisions. The exact integrations and deliverables are agreed for each project." },
  { q: "Do I need to know exactly what software I want?", a: "No. Start with a task you repeat, the tools you use, and where the work gets stuck. We can review an example together and decide whether a small software project, an existing tool, or a simpler process is the best next step." },
  { q: "How much does a project cost?", a: BUSINESS_PRICING },
  { q: "How does a project start?", a: "We review one workflow, agree a written scope and a useful success measure, then build and test the agreed solution with you. The handoff covers how to use it and the agreed documentation. Additional workflows and ongoing support are scoped separately." },
  { q: "Can you work with the tools we already use?", a: "Yes, when their supported integrations and your access allow it. Tell me which spreadsheets, accounting tools, storefronts, and other systems you use. We check the connection before promising it; sometimes a reviewed import or export is the right starting point." },
  { q: "Who owns the software and what happens after delivery?", a: "Ownership or licensing, account access, hosting, documentation, and maintenance responsibilities are agreed in writing before work begins. Ongoing support can be quoted separately with defined hours and scope. Your private business data is not a public demo." },
  { q: "How do I contact Jared about a project?", a: `Use the project inquiry on this page or email ${BUSINESS_EMAIL}. Describe the repeated task, the tools involved, and what you want to improve. Include your country or time zone for remote collaboration.` },
];

export function businessJsonLd() {
  return {
    "@context": "https://schema.org", "@type": "Service", "@id": `${BUSINESS_URL}#service`,
    name: BUSINESS_TITLE, description: BUSINESS_DESCRIPTION, url: BUSINESS_URL,
    serviceType: "Custom business software development and workflow automation",
    areaServed: "Worldwide", availableChannel: { "@type": "ServiceChannel", serviceUrl: BUSINESS_URL, availableLanguage: "English" },
    provider: { "@id": "https://www.tolley.io/#organization" },
    mainEntityOfPage: BUSINESS_URL,
  };
}

import { HM_CONTACT_PHONE } from './homes';

export const PC_PHONE = HM_CONTACT_PHONE;
export const PC_TEL = `tel:+1${PC_PHONE.replace(/\D/g, '')}`;
export const PC_SMS = `sms:+1${PC_PHONE.replace(/\D/g, '')}`;
export const PC_AREA = 'Independence, Missouri, and the Kansas City metro';
export const PC_TITLE = 'Custom PC Builds in Kansas City | Tolley PC';
export const PC_DESCRIPTION = `Custom gaming PCs, creator workstations, and specialized computers built by Jared Tolley, a former Apple Genius, in ${PC_AREA}. Get help choosing parts or bring your own for assembly. Request a personal quote: ${PC_PHONE}.`;
export const PC_PRICING = 'Each build is quoted individually. Parts, assembly, setup, and any additional work are agreed before ordering or building.';
export const PC_USES = [
  { id: 'gaming', name: 'Gaming & streaming', detail: 'Your games, resolution, and frame-rate goals. A balanced machine for the way you play.' },
  { id: 'creator', name: 'Creative work', detail: 'Video editing, music, photography, and 3D. Start with your software and the projects you actually make.' },
  { id: 'ai', name: 'AI & specialized builds', detail: 'Local AI, development, and compute-heavy projects. Plan around the workload, memory, cooling, and space.' },
  { id: 'everyday', name: 'Work & everyday use', detail: 'A dependable office PC, a quiet home setup, or a compact desktop. Make the everyday feel effortless.' },
] as const;
export const PC_PARTS = [
  { id: 'source', name: 'Help me choose & source parts', detail: 'Start with an idea and a budget.' },
  { id: 'supplied', name: 'I’m supplying the parts', detail: 'Bring your parts or your parts list.' },
  { id: 'unsure', name: 'Let’s figure it out together', detail: 'You don’t need a finished plan.' },
] as const;
export const PC_FAQ = [
  { q: 'Can you build a PC with parts I already bought?', a: 'Yes. Jared offers assembly using customer-supplied parts. Share the full parts list, including anything used or already owned, so compatibility and the scope of work can be reviewed before the build.' },
  { q: 'Can you help me choose and order the parts?', a: 'Yes. Start with what you want to do and your budget. Jared can plan a parts list and source components from Micro Center or suitable online retailers, subject to stock and your approval of the quote.' },
  { q: 'How much does a custom PC build cost?', a: PC_PRICING + ' You can request assembly only or help with the whole build. Send your budget or parts list for a quote.' },
  { q: 'What kinds of computers can you build?', a: 'Gaming and streaming PCs, creative workstations, everyday and office desktops, and specialized machines for local AI, development, and other demanding workloads. The parts and configuration are chosen around your actual use.' },
  { q: 'What is your computer repair and building experience?', a: 'Jared spent five years as an Apple Genius working on Macs, including machines valued at $10,000 or more. He helped open stores and train employees, then started a mining company and custom-built its machines.' },
  { q: 'Where do you build, and how do I arrange a handoff?', a: `Based in ${PC_AREA}. Include your city when you inquire. Jared will confirm service coverage and arrange the handoff directly before you bring or send any equipment.` },
  { q: 'Does submitting the form book a build date?', a: 'The form starts a conversation. Jared will confirm the parts, price, scope, and available timing with you before a build is booked. A preferred date is a request, not a reserved appointment.' },
  { q: 'What about parts warranties and support?', a: 'Ask about the parts, testing, setup, and support included in your specific quote. Manufacturer and retailer warranty terms depend on the component and purchase. Customer-supplied parts and any troubleshooting are discussed before work begins.' },
];

import { HM_CONTACT_PHONE } from './homes';
export const REPAIR_PHONE = HM_CONTACT_PHONE;
export const REPAIR_TEL = `tel:+1${REPAIR_PHONE.replace(/\D/g, '')}`;
export const REPAIR_SMS = `sms:+1${REPAIR_PHONE.replace(/\D/g, '')}`;
export const REPAIR_AREA = 'Independence, Missouri, and surrounding Kansas City communities';
export const REPAIR_DESCRIPTION = 'Home repairs, furniture removal, garage and property cleanouts, estate-sale coordination, and home-selling help with Jared Tolley in Independence, Missouri, and surrounding areas. One conversation to plan the work and your next move.';
export const REPAIR_SERVICES = [
  { id: 'repairs', title: 'Fix the little things.', label: 'Home repairs', description: 'Drywall patches, paint touch-ups, trim, doors, and small carpet jobs. Bring the whole fix-it list.' },
  { id: 'removal', title: 'Make some room.', label: 'Furniture removal', description: 'An unwanted couch, bulky furniture, or household items ready to go. Tell me what needs moving and how we can access it.' },
  { id: 'cleanouts', title: 'Get your space back.', label: 'Garage & property cleanouts', description: 'Garages, basements, rental move-outs, and whole-home clearing. We can plan the clearing and repairs together.', href: '/cleanouts' },
  { id: 'estate', title: 'Sort out what comes next.', label: 'Estate sales & downsizing', description: 'Help with belongings after an inheritance, a move, or downsizing, including coordination with Tolley Estate Sales.', href: '/estate' },
  { id: 'selling', title: 'Get the house ready.', label: 'Home-selling preparation', description: 'Work through repairs, belongings, and a selling plan. Explore representation through Your KC Homes.', href: '/homes' },
  { id: 'investor', title: 'Explore your options.', label: 'Investors & as-is sales', description: 'Investor connections, rental turnovers, flip preparation, and a conversation about selling a property as-is. No guaranteed offer or closing date.', href: '/homes' },
];
export const REPAIR_FAQ = [
  { q: 'Can you help with more than one thing?', a: 'Yes. Tell Jared about the whole situation. Suitable repairs and cleanouts can be handled directly, with other services coordinated as needed. Each part is scoped and priced before you agree.' },
  { q: 'What does it cost?', a: 'Pricing depends on the work, materials, access, hauling, and disposal needs. Send a description and photos to start; some jobs need a walkthrough before a quote. There are no published flat rates for repairs.' },
  { q: 'Do you handle plumbing, electrical, or water heaters?', a: 'Describe what you need. Jared will discuss the scope and whether an appropriately qualified trade professional is needed. Work is subject to local licensing and permit requirements.' },
  { q: 'Can you help me sell without fixing everything?', a: 'We can discuss an as-is sale, investor introductions, and listing options through Your KC Homes. An introduction is not a cash offer or a promise to purchase your home.' },
  { q: 'Is everything included in one fee?', a: 'Repairs, cleanouts, estate sales, and real estate representation have separately agreed scopes and pricing. You choose which services make sense for you.' },
  { q: 'Where do you work?', a: `Based in Independence and serving ${REPAIR_AREA}. Share the property city and timing so Jared can confirm service coverage and scheduling.` },
];

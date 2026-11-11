import type { SubsiteManifest } from '@/lib/agent-manifest';
import { PC_AREA, PC_DESCRIPTION, PC_FAQ, PC_PARTS, PC_PHONE, PC_PRICING, PC_TITLE, PC_USES } from '@/lib/pc';

export const manifest: SubsiteManifest = {
  name: 'pc', title: PC_TITLE, purpose: PC_DESCRIPTION, url: '/pc', schemaType: 'Service',
  category: 'marketing', status: 'public', serviceArea: PC_AREA,
  jsonEndpoints: [], leadEndpoint: '/api/lead/action', leadSource: 'pc', shareEndpoint: '/api/share', mcpTools: [],
  keywords: ['custom PC builder Kansas City', 'PC assembly Independence MO', 'build a PC with my parts', 'gaming PC builder', 'custom workstation'],
  faq: PC_FAQ,
  discovery: { disposition: 'offering', canonicalUrl: 'https://www.tolley.io/pc', reviewedAt: '2026-11-11', verification: 'repository', operator: 'Jared Tolley', phone: PC_PHONE, evidence: [], pricingNote: PC_PRICING },
  actions: [{
    verb: 'request_pc_build', description: 'Request a personal quote for a custom computer or assembly with customer-supplied parts. Timing and price must be confirmed by Jared; this does not book an appointment.',
    fields: {
      useCase: { type: 'enum', required: true, enum: [...PC_USES.map(u => u.id), 'unsure'], description: 'Primary use for the computer' },
      parts: { type: 'enum', required: true, enum: PC_PARTS.map(p => p.id), description: 'Whether Jared should source parts or the customer supplies them' },
      city: { type: 'string', required: true, description: 'Customer city for service and handoff planning' },
      budget: { type: 'string', description: 'Approximate budget and whether it includes parts' },
      preferredDate: { type: 'date', description: 'Optional requested date, subject to confirmation' },
      partsList: { type: 'string', description: 'Optional parts list or link supplied by the customer' },
      notes: { type: 'string', required: true, description: 'Games, software, requirements, appearance, noise, size, and other build goals' },
    },
  }],
};

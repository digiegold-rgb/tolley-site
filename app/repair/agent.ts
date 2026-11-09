import type { SubsiteManifest } from '@/lib/agent-manifest';
import { REPAIR_AREA, REPAIR_DESCRIPTION, REPAIR_FAQ, REPAIR_PHONE } from '@/lib/repair';
export const manifest: SubsiteManifest = {
  name: 'repair', title: 'Tolley Repair & Property Services | Independence, MO', purpose: REPAIR_DESCRIPTION,
  url: '/repair', schemaType: 'Service', jsonEndpoints: [], leadEndpoint: '/api/lead/action', leadSource: 'repair',
  shareEndpoint: '/api/share', mcpTools: [], category: 'marketing', status: 'public', serviceArea: REPAIR_AREA, faq: REPAIR_FAQ,
  discovery: { disposition: 'offering', canonicalUrl: 'https://www.tolley.io/repair', reviewedAt: '2026-11-09', verification: 'repository', operator: 'Jared Tolley', phone: REPAIR_PHONE, evidence: [], pricingNote: 'Job-specific quotes. Scope, pricing, and scheduling are agreed before work begins.' },
  actions: [{ verb: 'request_property_help', description: 'Ask Jared about repairs, removal, cleanouts, estate sales, or property sale options.', fields: {
    services: { type: 'string', required: true, description: 'Comma-separated service IDs: repairs, removal, cleanouts, estate, selling, investor, or unsure' },
    address: { type: 'string', required: true, description: 'Property city or address' },
    timeline: { type: 'enum', enum: ['flexible', 'soon', 'month', 'exploring'] },
    notes: { type: 'string', required: true, description: 'Description of the work or situation' },
  } }],
};

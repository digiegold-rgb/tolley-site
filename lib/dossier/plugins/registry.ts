/**
 * Plugin Registry — central registration point for all dossier plugins.
 *
 * To add a new plugin:
 * 1. Create a file in lib/dossier/plugins/ implementing DossierPlugin
 * 2. Import and add it to the PLUGINS array below
 * 3. That's it — the pipeline will pick it up automatically
 */

import type { DossierPlugin } from "../types";
import { countyAssessorPlugin } from "./county-assessor";
import { courtRecordsPlugin } from "./court-records";
import { peopleSearchPlugin } from "./people-search";
import { skipTracePlugin } from "./skip-trace";
import { streetViewPlugin } from "./street-view";
import { propertyHistoryPlugin } from "./property-history";
import { financialPlugin } from "./financial";
// ── Future plugins (uncomment when implemented) ──
// import { neighborhoodPlugin } from "./neighborhood";
// import { permitsPlugin } from "./permits";
// import { rentalPlugin } from "./rental";
// import { businessPlugin } from "./business";
// import { environmentalPlugin } from "./environmental";
// import { marketPlugin } from "./market";
// import { socialDeepPlugin } from "./social-deep";
// import { aiSummaryPlugin } from "./ai-summary";

/**
 * Master plugin list. Order doesn't matter — plugins are sorted by priority.
 * Disable a plugin by setting enabled: false in its definition.
 */
const PLUGINS: DossierPlugin[] = [
  countyAssessorPlugin,     // priority 10 — owner names (everything else depends on this)
  propertyHistoryPlugin,    // priority 15 — deed history, prior sales
  skipTracePlugin,          // priority 20 — phone/email/age (needs owner names)
  courtRecordsPlugin,       // priority 30 — legal records (needs owner names)
  peopleSearchPlugin,       // priority 40 — web/social search (needs owner names)
  streetViewPlugin,         // priority 50 — property/area photos (independent)
  financialPlugin,          // priority 60 — equity estimation (depends on assessor + history)
  // ── Future plugins slot in by priority ──
  // neighborhoodPlugin,    // priority 55
  // permitsPlugin,         // priority 65
  // rentalPlugin,          // priority 70
  // businessPlugin,        // priority 75
  // environmentalPlugin,   // priority 80
  // marketPlugin,          // priority 85
  // socialDeepPlugin,      // priority 90
  // aiSummaryPlugin,       // priority 99 — runs last, summarizes everything
];

/** Get all registered plugins sorted by priority */
export function getAllPlugins(): DossierPlugin[] {
  return [...PLUGINS].sort((a, b) => a.priority - b.priority);
}

/** Get only enabled plugins sorted by priority */
export function getEnabledPlugins(): DossierPlugin[] {
  return getAllPlugins().filter((p) => p.enabled);
}

/** Get a plugin by name */
export function getPlugin(name: string): DossierPlugin | undefined {
  return PLUGINS.find((p) => p.name === name);
}

/** Check which plugins have their required config available */
export function getReadyPlugins(): { ready: DossierPlugin[]; notReady: { plugin: DossierPlugin; missing: string[] }[] } {
  const enabled = getEnabledPlugins();
  const ready: DossierPlugin[] = [];
  const notReady: { plugin: DossierPlugin; missing: string[] }[] = [];

  for (const plugin of enabled) {
    const missing = plugin.requiredConfig.filter((key) => !process.env[key]);
    if (missing.length === 0) {
      ready.push(plugin);
    } else {
      notReady.push({ plugin, missing });
    }
  }

  return { ready, notReady };
}

/** Get plugin manifest (for API/UI — shows what's available) */
export function getPluginManifest() {
  return getAllPlugins().map((p) => ({
    name: p.name,
    label: p.label,
    description: p.description,
    category: p.category,
    enabled: p.enabled,
    priority: p.priority,
    estimatedDuration: p.estimatedDuration,
    requiredConfig: p.requiredConfig,
    dependsOn: p.dependsOn,
    configReady: p.requiredConfig.every((key) => !!process.env[key]),
  }));
}
